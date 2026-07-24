import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  adminGetDeliveryTasks,
  adminGetOrdersWithDelivery,
  adminGetDeliveryMen,
  adminApproveTask,
  adminRejectTask,
  adminAssignTask,
  adminOverrideStatus,
} from '../api';
import './AdminDeliveryPanel.css';

// ── Status config ─────────────────────────────────────────────────────────
const STATUS_META = {
  requested: { label: 'Requested',  color: 'yellow', icon: '⏳' },
  assigned:  { label: 'Assigned',   color: 'blue',   icon: '📦' },
  picked_up: { label: 'Picked Up',  color: 'orange', icon: '🚚' },
  delivered: { label: 'Delivered',  color: 'green',  icon: '✅' },
  rejected:  { label: 'Rejected',   color: 'red',    icon: '✗'  },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'grey', icon: '•' };
  return (
    <span className={`adp-badge adp-badge-${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

function ts(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString();
}

// ── Task row in Requests table ────────────────────────────────────────────
function TaskRow({ task, deliveryMen, onRefresh }) {
  const [busy,   setBusy]   = useState(false);
  const [dmId,   setDmId]   = useState(task.delivery_man_id || '');
  const [err,    setErr]    = useState('');

  const handle = async (action) => {
    setBusy(true); setErr('');
    try {
      if (action === 'approve') await adminApproveTask(task.id, dmId || undefined);
      if (action === 'reject')  await adminRejectTask(task.id);
      onRefresh();
    } catch (e) {
      setErr(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleOverride = async (e) => {
    const newStatus = e.target.value;
    if (!newStatus) return;
    setBusy(true); setErr('');
    try {
      await adminOverrideStatus(task.id, newStatus);
      onRefresh();
    } catch (e) {
      setErr(e.message || 'Override failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className={`adp-row ${task.status === 'rejected' ? 'row-rejected' : ''}`}>
      <td className="mono">#{task.order_id}</td>
      <td>
        {task.delivery_man
          ? <span className="dm-name">👤 {task.delivery_man.username}</span>
          : <span className="no-dm">—</span>}
      </td>
      <td><StatusBadge status={task.status} /></td>
      <td className="mono small">{ts(task.requested_at)}</td>
      <td className="mono small">{ts(task.assigned_at)}</td>
      <td className="mono small">{ts(task.picked_up_at)}</td>
      <td className="mono small">{ts(task.delivered_at)}</td>

      <td>
        {/* Approve / reject (only for requested) */}
        {task.status === 'requested' && (
          <div className="adp-actions">
            <select
              value={dmId}
              onChange={(e) => setDmId(e.target.value)}
              className="dm-select"
              disabled={busy}
            >
              <option value="">Keep requester</option>
              {deliveryMen
                .filter((d) => d.id !== task.delivery_man_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.username}</option>
                ))}
            </select>
            <button
              className="adp-btn approve-btn"
              onClick={() => handle('approve')}
              disabled={busy}
            >✓ Approve</button>
            <button
              className="adp-btn reject-btn"
              onClick={() => handle('reject')}
              disabled={busy}
            >✗ Reject</button>
          </div>
        )}

        {/* Override for non-terminal states */}
        {task.status !== 'delivered' && task.status !== 'rejected' && task.status !== 'requested' && (
          <select
            onChange={handleOverride}
            defaultValue=""
            className="override-select"
            disabled={busy}
          >
            <option value="" disabled>Override…</option>
            {Object.keys(STATUS_META)
              .filter((s) => s !== task.status)
              .map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
          </select>
        )}

        {!['requested','assigned','picked_up'].includes(task.status) && '—'}
      </td>

      {err && (
        <td colSpan={8}>
          <span className="row-error">{err}</span>
        </td>
      )}
    </tr>
  );
}

// ── Order row in Tracking table ───────────────────────────────────────────
function OrderTrackRow({ order, deliveryMen, onRefresh }) {
  const task = order.delivery_task;
  const [busy,    setBusy]    = useState(false);
  const [dmId,    setDmId]    = useState('');
  const [err,     setErr]     = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleDirectAssign = async () => {
    if (!dmId) { setErr('Select a delivery man'); return; }
    setBusy(true); setErr('');
    try {
      await adminAssignTask(order.id, Number(dmId));
      onRefresh();
    } catch (e) {
      setErr(e.message || 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr
        className={`adp-row ${expanded ? 'row-expanded' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: 'pointer' }}
      >
        <td className="mono">#{order.id}</td>
        <td className="mono">${Number(order.total_amount).toFixed(2)}</td>
        <td className="mono small">{ts(order.created_at)}</td>
        <td>
          {task
            ? <StatusBadge status={task.status} />
            : <span className="no-task">No task</span>}
        </td>
        <td>
          {task?.delivery_man
            ? <span className="dm-name">👤 {task.delivery_man.username}</span>
            : <span className="no-dm">—</span>}
        </td>
        <td className="mono small">{task ? ts(task.delivered_at) : '—'}</td>
        <td><span className="expand-icon">{expanded ? '▲' : '▼'}</span></td>
      </tr>

      {expanded && (
        <tr className="adp-expanded-row">
          <td colSpan={7}>
            <div className="expanded-body">
              {/* Items */}
              <div className="exp-section">
                <h4>Items</h4>
                <ul className="exp-items">
                  {(order.items || []).map((item, i) => (
                    <li key={i}>
                      {item.product_name}
                      <span className="exp-qty">×{item.quantity}</span>
                      <span className="exp-price">${Number(item.line_total).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Address */}
              {order.shipping_address && (
                <div className="exp-section">
                  <h4>Ship To</h4>
                  <p>{order.shipping_address.full_name}</p>
                  <p>{order.shipping_address.line1}, {order.shipping_address.city}</p>
                  <p>{order.shipping_address.country} · {order.shipping_address.phone}</p>
                </div>
              )}

              {/* Task timeline */}
              {task && (
                <div className="exp-section">
                  <h4>Timeline</h4>
                  <div className="exp-timeline">
                    {[
                      ['Requested', task.requested_at],
                      ['Assigned',  task.assigned_at],
                      ['Picked Up', task.picked_up_at],
                      ['Delivered', task.delivered_at],
                    ].map(([label, t]) => (
                      <div key={label} className={`exp-tl-row ${t ? 'done' : ''}`}>
                        <span className="exp-tl-dot">{t ? '●' : '○'}</span>
                        <span className="exp-tl-label">{label}</span>
                        <span className="exp-tl-ts">{ts(t)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct assign (if no active task) */}
              {!task && (
                <div className="exp-section">
                  <h4>Assign Delivery Man</h4>
                  <div className="direct-assign-row">
                    <select
                      value={dmId}
                      onChange={(e) => setDmId(e.target.value)}
                      className="dm-select"
                      disabled={busy}
                    >
                      <option value="">Select delivery man…</option>
                      {deliveryMen.map((d) => (
                        <option key={d.id} value={d.id}>{d.username}</option>
                      ))}
                    </select>
                    <button
                      className="adp-btn approve-btn"
                      onClick={handleDirectAssign}
                      disabled={busy || !dmId}
                    >
                      {busy ? 'Assigning…' : 'Assign'}
                    </button>
                  </div>
                  {err && <p className="row-error">{err}</p>}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminDeliveryPanel() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [tab,          setTab]         = useState('requests');  // 'requests' | 'tracking'
  const [tasks,        setTasks]       = useState([]);
  const [orders,       setOrders]      = useState([]);
  const [deliveryMen,  setDeliveryMen] = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Auth guard
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!user.is_admin) { navigate('/'); }
  }, [user, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [tasksRes, ordersRes, dmRes] = await Promise.all([
        adminGetDeliveryTasks(statusFilter),
        adminGetOrdersWithDelivery(),
        adminGetDeliveryMen(),
      ]);
      setTasks(Array.isArray(tasksRes.tasks) ? tasksRes.tasks : []);
      setOrders(Array.isArray(ordersRes.orders) ? ordersRes.orders : []);
      setDeliveryMen(Array.isArray(dmRes.delivery_men) ? dmRes.delivery_men : []);
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Stats
  const statuses = ['requested', 'assigned', 'picked_up', 'delivered', 'rejected'];
  const counts = statuses.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s).length;
    return acc;
  }, {});

  if (!user || !user.is_admin) return null;

  return (
    <div className="adp-page">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="adp-header">
        <div>
          <p className="adp-subtitle">Admin Panel</p>
          <h1 className="adp-title">Delivery Management</h1>
        </div>
        <button className="adp-refresh" onClick={loadData} disabled={loading}>
          {loading ? '↻' : '↻ Refresh'}
        </button>
      </header>

      {/* ── Summary cards ────────────────────────────────────────────── */}
      <div className="adp-summary">
        {statuses.map((s) => {
          const m = STATUS_META[s];
          return (
            <button
              key={s}
              className={`adp-stat-card adp-stat-${m.color} ${statusFilter === s ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter((v) => v === s ? '' : s);
                setTab('requests');
              }}
            >
              <span className="adp-stat-icon">{m.icon}</span>
              <strong>{counts[s] ?? 0}</strong>
              <span>{m.label}</span>
            </button>
          );
        })}
        <div className="adp-stat-card adp-stat-neutral">
          <span className="adp-stat-icon">👥</span>
          <strong>{deliveryMen.length}</strong>
          <span>Delivery Men</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="adp-tabs">
        <button
          className={`adp-tab ${tab === 'requests' ? 'active' : ''}`}
          onClick={() => setTab('requests')}
        >
          Task Requests
          {counts.requested > 0 && (
            <span className="adp-tab-badge">{counts.requested}</span>
          )}
        </button>
        <button
          className={`adp-tab ${tab === 'tracking' ? 'active' : ''}`}
          onClick={() => setTab('tracking')}
        >
          Order Tracking
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="adp-body">
        {loading && (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading…</p>
          </div>
        )}

        {error && <div className="adp-error">{error}</div>}

        {/* Task Requests table */}
        {!loading && tab === 'requests' && (
          <>
            <div className="adp-table-wrap">
              <table className="adp-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Delivery Man</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Assigned</th>
                    <th>Picked Up</th>
                    <th>Delivered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="adp-empty-cell">
                        No tasks found{statusFilter ? ` with status "${statusFilter}"` : ''}.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        deliveryMen={deliveryMen}
                        onRefresh={loadData}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Order tracking table */}
        {!loading && tab === 'tracking' && (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Amount</th>
                  <th>Placed At</th>
                  <th>Delivery Status</th>
                  <th>Delivery Man</th>
                  <th>Delivered At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="adp-empty-cell">
                      No paid orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <OrderTrackRow
                      key={order.id}
                      order={order}
                      deliveryMen={deliveryMen}
                      onRefresh={loadData}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}