import type { Annotation } from '@/store/useStore';

interface Props {
  annotations: Annotation[];
}

const ActionAnnotationOverlay = ({ annotations }: Props) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {annotations.map((a, i) => {
      if (a.type === 'click') {
        return (
          <div
            key={i}
            className="absolute ripple-circle rounded-full border-2 border-secondary"
            style={{ left: a.x - 16, top: a.y - 16, width: 32, height: 32 }}
          />
        );
      }
      if (a.type === 'type') {
        return (
          <div
            key={i}
            className="absolute type-pill-fade rounded-pill bg-primary px-2 py-0.5 text-xs text-primary-foreground font-medium"
            style={{ left: a.x, top: a.y - 24 }}
          >
            {a.text}
          </div>
        );
      }
      if (a.type === 'scroll') {
        return (
          <div
            key={i}
            className="absolute text-muted-foreground"
            style={{ left: a.x, top: a.y }}
          >
            ↕
          </div>
        );
      }
      return null;
    })}
  </div>
);

export default ActionAnnotationOverlay;
