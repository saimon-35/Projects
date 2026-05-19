import { useRef, useState } from 'react';
import { uploadProductImage } from '../api.js';
import './ImageUploader.css';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const API_URL = import.meta.env.VITE_API_URL;

export default function ImageUploader({ currentUrl, onUploaded }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file) => {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setError('Only PNG, JPG, GIF and WEBP images are allowed.');
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('File is too large. Maximum size is 5 MB.');
      return;
    }

    setError('');

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const data = await uploadProductImage(file);
      console.log(data.url);
      onUploaded(`${API_URL}${data.url}`); // pass the server URL back to the parent form
      URL.revokeObjectURL(objectUrl);
      setPreview(`${API_URL}${data.url}`); // update preview to use the server URL
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.');
      setPreview(currentUrl || '');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClear = () => {
    setPreview('');
    onUploaded('');
    setError('');
  };

  return (
    <div className="image-uploader">
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${preview ? 'has-preview' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload product image"
      >
        {preview ? (
          <div className="preview-wrap">
            <img src={preview} alt="Product preview" className="preview-img" />
            {uploading && (
              <div className="upload-overlay">
                <span className="upload-spinner" />
                <span>Uploading…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="drop-prompt">
            <span className="drop-icon">🖼️</span>
            <p className="drop-title">
              {uploading ? 'Uploading…' : 'Drop image here'}
            </p>
            <p className="drop-sub">or click to browse · PNG, JPG, GIF, WEBP · max 5 MB</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      <div className="uploader-actions">
        <button
          type="button"
          className="upload-browse-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : preview ? '↩ Replace image' : '📁 Browse files'}
        </button>

        {preview && !uploading && (
          <button type="button" className="upload-clear-btn" onClick={handleClear}>
            ✕ Remove
          </button>
        )}
      </div>

      {error && (
        <p className="uploader-error" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
