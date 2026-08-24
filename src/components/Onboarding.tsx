import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMapStore } from '../store/mapStore';
import { fileToResizedDataUrl } from '../utils/resizeImage';

export function Onboarding() {
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const initMap = useMapStore((s) => s.initMap);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  async function onPhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhotoError(null);
      setPhotoUrl(await fileToResizedDataUrl(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'לא ניתן היה לטעון את התמונה');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    initMap(trimmed, photoUrl);
  }

  return (
    <div className="onboarding">
      <form className="onboarding-card" onSubmit={onSubmit}>
        <h1>ברוכים הבאים למפת החשיבה</h1>
        <p>הזינו את שמכם או כותרת למפה כדי להתחיל</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: המפה של דנה"
        />

        <div className="onboarding-photo">
          <div className="onboarding-photo-preview">
            {photoUrl ? (
              <img src={photoUrl} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z"
                />
              </svg>
            )}
          </div>
          <div className="onboarding-photo-actions">
            <button type="button" className="btn-secondary" onClick={() => uploadInputRef.current?.click()}>
              העלה תמונה
            </button>
            <button type="button" className="btn-secondary" onClick={() => selfieInputRef.current?.click()}>
              צלם סלפי
            </button>
            {photoUrl && (
              <button type="button" className="onboarding-photo-remove" onClick={() => setPhotoUrl(null)}>
                הסר תמונה
              </button>
            )}
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPhotoChosen}
          />
          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={onPhotoChosen}
          />
          {photoError && <span className="onboarding-photo-error">{photoError}</span>}
        </div>

        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          התחילו למפות
        </button>
      </form>
    </div>
  );
}
