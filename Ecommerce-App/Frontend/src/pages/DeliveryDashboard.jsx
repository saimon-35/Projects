import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAvailableOrders,
  getMyTasks,
  requestDeliveryTask,
  updateDeliveryStatus
} from '../api.js';

import './DeliveryDashboard.css';

// ── Status config ─────────────────────────────────────────────────────────
const STATUS_META = {
  requested: { label: 'Requested',  color: 'yellow',  icon: '⏳' },
  assigned:  { label: 'Assigned',   color: 'blue',    icon: '📦' },
  picked_up: { label: 'Picked Up',  color: 'orange',  icon: '🚚' },
  delivered: { label: 'Delivered',  color: 'green',   icon: '✅' },
  rejected:  { label: 'Rejected',   color: 'red',     icon: '✗'  },
};

const TIMELINE_STEPS = ['requested', 'assigned', 'picked_up', 'delivered'];

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'grey', icon: '•' };
  return (
    <span className={`status-badge status-${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function Timeline({ status }) {
  const currentIdx = TIMELINE_STEPS.indexOf(status);
  return (
    <div className="timeline">
      {TIMELINE_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const meta    = STATUS_META[step];
        return (
          <div key={step} className={`tl-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <div className="tl-dot">
              {done ? '✓' : active ? meta.icon : ''}
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`tl-line ${done ? 'done' : ''}`} />
            )}
            <span className="tl-label">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onStatusUpdate }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const nextStatus = { assigned: 'picked_up', picked_up: 'delivered' };
  const next = nextStatus[task.status];

  const handleAdvance = async () => {
    if (!next) return;
    setBusy(true); setErr('');
    try {
      await updateDeliveryStatus(task.id, next);
      onStatusUpdate();
    } catch (e) {
      setErr(e.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const addr = task.order?.shipping_address;

  return (
    <article className="task-card">
      <div className="task-card-header">
        <div className="task-order-id">Order #{task.order_id}</div>
        <StatusBadge status={task.status} />
      </div>

      {task.status !== 'rejected' && <Timeline status={task.status} />}

      <div className="task-body">
        {task.order?.items?.length > 0 && (
          <ul className="task-items">
            {task.order.items.map((item, i) => (
              <li key={i}>
                <span className="item-name">{item.product_name}</span>
                <span className="item-qty">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        )}

        {addr && (
          <div className="task-address">
            <span className="addr-icon">📍</span>
            <div>
              <strong>{addr.full_name}</strong>
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p>{addr.city}, {addr.state} {addr.postal_code}</p>
              <p>{addr.country} · {addr.phone}</p>
            </div>
          </div>
        )}

        <div className="task-meta">
          <span>Requested: {new Date(task.requested_at).toLocaleString()}</span>
          {task.assigned_at  && <span>Assigned: {new Date(task.assigned_at).toLocaleString()}</span>}
          {task.picked_up_at && <span>Picked up: {new Date(task.picked_up_at).toLocaleString()}</span>}
          {task.delivered_at && <span>Delivered: {new Date(task.delivered_at).toLocaleString()}</span>}
        </div>
      </div>

      {err && <p className="task-error">{err}</p>}

      {next && (
        <button
          className="advance-btn"
          onClick={handleAdvance}
          disabled={busy}
        >
          {busy ? 'Updating…' : next === 'picked_up' ? '🚚 Mark Picked Up' : '✅ Mark Delivered'}
        </button>
      )}
    </article>
  );
}

function AvailableOrderCard({ order, onRequested, busyId }) {
  const [err, setErr] = useState('');
  const busy = busyId === order.id;

  const handleRequest = async () => {
    setErr('');
    try {
      await requestDeliveryTask(order.id);
      onRequested();
    } catch (e) {
      setErr(e.message || 'Request failed');
    }
  };

  const addr = order.shipping_address;

  return (
    <article className="avail-card">
      <div className="avail-header">
        <span className="avail-order-id">Order #{order.id}</span>
        <span className="avail-amount">${Number(order.total_amount).toFixed(2)}</span>
      </div>

      {addr && (
        <div className="avail-address">
          <span>📍 {addr.city}, {addr.state}, {addr.country}</span>
        </div>
      )}

      <div className="avail-items">
        {(order.items || []).slice(0, 3).map((item, i) => (
          <span key={i} className="avail-item-tag">{item.product_name}</span>
        ))}
        {(order.items || []).length > 3 && (
          <span className="avail-item-tag more">+{order.items.length - 3} more</span>
        )}
      </div>

      {err && <p className="task-error">{err}</p>}

      <button
        className="request-btn"
        onClick={handleRequest}
        disabled={busy}
      >
        {busy ? 'Requesting…' : '📬 Request Delivery'}
      </button>
    </article>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [tab,            setTab]           = useState('tasks');   // 'tasks' | 'available'
  const [myTasks,        setMyTasks]       = useState([]);
  const [availOrders,    setAvailOrders]   = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState('');
  const [statusFilter,   setStatusFilter]  = useState('all');
  const [busyRequestId,  setBusyRequestId] = useState(null);

  // Auth guard
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'delivery_man') { navigate('/'); }
  }, [user, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [tasksRes, ordersRes] = await Promise.all([
        getMyTasks(),
        getAvailableOrders(),
      ]);
      setMyTasks(Array.isArray(tasksRes.tasks) ? tasksRes.tasks : []);
      setAvailOrders(Array.isArray(ordersRes.orders) ? ordersRes.orders : []);
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTasks = myTasks.filter(
    (t) => statusFilter === 'all' || t.status === statusFilter
  );

  const activeTasks = myTasks.filter(
    (t) => !['delivered', 'rejected'].includes(t.status)
  ).length;

  if (!user || user.role !== 'delivery_man') return null;

  return (
    <div className="dd-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="dd-header">
        <div className="dd-header-left">
          <div className="dd-avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <p className="dd-greeting">Hello, {user.username}</p>
            <h1 className="dd-title">Delivery Dashboard</h1>
          </div>
        </div>
        <div className="dd-stats">
          <div className="dd-stat">
            <strong>{myTasks.length}</strong>
            <span>Total Tasks</span>
          </div>
          <div className="dd-stat">
            <strong>{activeTasks}</strong>
            <span>Active</span>
          </div>
          <div className="dd-stat">
            <strong>{myTasks.filter(t => t.status === 'delivered').length}</strong>
            <span>Delivered</span>
          </div>
          <div className="dd-stat">
            <strong>{availOrders.length}</strong>
            <span>Available</span>
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="dd-tabs">
        <button
          className={`dd-tab ${tab === 'tasks' ? 'active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          My Tasks
          {activeTasks > 0 && <span className="tab-badge">{activeTasks}</span>}
        </button>
        <button
          className={`dd-tab ${tab === 'available' ? 'active' : ''}`}
          onClick={() => setTab('available')}
        >
          Available Orders
          {availOrders.length > 0 && (
            <span className="tab-badge available">{availOrders.length}</span>
          )}
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="dd-body">
        {loading && (
          <div className="dd-loading">
            <div className="dd-spinner" />
            <p>Loading…</p>
          </div>
        )}

        {error && <div className="dd-error">{error}</div>}

        {/* My Tasks */}
        {!loading && tab === 'tasks' && (
          <>
            <div className="dd-filter-row">
              {['all', 'requested', 'assigned', 'picked_up', 'delivered', 'rejected'].map((s) => (
                <button
                  key={s}
                  className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="dd-empty">
                <span>📭</span>
                <p>No tasks yet. Check <em>Available Orders</em> to get started.</p>
              </div>
            ) : (
              <div className="dd-grid">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onStatusUpdate={loadData} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Available Orders */}
        {!loading && tab === 'available' && (
          <>
            {availOrders.length === 0 ? (
              <div className="dd-empty">
                <span>🎉</span>
                <p>No available orders right now. Check back soon!</p>
              </div>
            ) : (
              <div className="dd-grid avail-grid">
                {availOrders.map((order) => (
                  <AvailableOrderCard
                    key={order.id}
                    order={order}
                    busyId={busyRequestId}
                    onRequested={() => {
                      setBusyRequestId(null);
                      loadData();
                      setTab('tasks');
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}