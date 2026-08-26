import { useMapStore } from '../store/mapStore';

/** A persistent panel at the side of the screen, mirroring the root's onboarding photo. */
export function SidePhotoPanel() {
  const photoUrl = useMapStore((s) => s.photoUrl);
  const title = useMapStore((s) => s.title);

  if (!photoUrl) return null;

  return (
    <div className="mm-side-photo">
      <img src={photoUrl} alt="" />
      <span className="mm-side-photo-title">{title}</span>
    </div>
  );
}
