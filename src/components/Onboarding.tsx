import { useState, type FormEvent } from 'react';
import { useMapStore } from '../store/mapStore';

export function Onboarding() {
  const [name, setName] = useState('');
  const initMap = useMapStore((s) => s.initMap);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    initMap(trimmed);
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
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          התחילו למפות
        </button>
      </form>
    </div>
  );
}
