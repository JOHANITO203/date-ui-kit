import React from 'react';

type RailTone = 'likes' | 'boost' | 'profile';

type RailSection = {
  id: string;
  label: string;
};

type VerticalPageRailProps = {
  visible: boolean;
  progress: number;
  thumb: number;
  tone: RailTone;
  sections: RailSection[];
  onJump: (index: number) => void;
  onSeekRatio?: (ratio: number) => void;
};

const toneClasses: Record<
  RailTone,
  {
    panelBorder: string;
    panelShadow: string;
    trackBg: string;
    thumbBg: string;
    activeBullet: string;
    idleBullet: string;
  }
> = {
  likes: {
    panelBorder: 'border-fuchsia-300/20',
    panelShadow: 'shadow-[0_8px_20px_rgba(192,38,211,0.16)]',
    trackBg: 'bg-[#090a12]/92',
    thumbBg: 'from-pink-400 via-fuchsia-400 to-blue-400',
    activeBullet: 'bg-pink-300',
    idleBullet: 'bg-white/35',
  },
  boost: {
    panelBorder: 'border-amber-300/20',
    panelShadow: 'shadow-[0_8px_20px_rgba(251,146,60,0.16)]',
    trackBg: 'bg-[#110b04]/92',
    thumbBg: 'from-orange-400 via-amber-300 to-yellow-200',
    activeBullet: 'bg-amber-300',
    idleBullet: 'bg-white/35',
  },
  profile: {
    panelBorder: 'border-white/16',
    panelShadow: 'shadow-[0_8px_20px_hsl(var(--plan-hue)_var(--plan-sat)_40%_/_0.14)]',
    trackBg: 'bg-[#090a12]/92',
    thumbBg: 'from-[hsl(var(--plan-hue)_var(--plan-sat)_72%_/_0.96)] to-[hsl(var(--plan-comp-hue)_68%_66%_/_0.92)]',
    activeBullet: 'bg-white/90',
    idleBullet: 'bg-white/35',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const VerticalPageRail: React.FC<VerticalPageRailProps> = ({
  visible,
  progress,
  thumb,
  tone,
  sections,
  onJump,
  onSeekRatio,
}) => {
  if (!visible || sections.length === 0) return null;

  const toneClass = toneClasses[tone];
  const normalizedProgress = clamp(progress, 0, 1);
  const normalizedThumb = clamp(thumb, 14, 100);
  const activeIndex = clamp(Math.round(normalizedProgress * (sections.length - 1)), 0, sections.length - 1);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const draggingRef = React.useRef(false);
  const lastWheelTsRef = React.useRef(0);

  const seekRatio = React.useCallback(
    (ratio: number) => {
      if (!onSeekRatio) return;
      onSeekRatio(clamp(ratio, 0, 1));
    },
    [onSeekRatio],
  );

  const seekByWheel = React.useCallback(
    (deltaY: number) => {
      if (!onSeekRatio) return;
      const nextRatio = clamp(normalizedProgress + deltaY * 0.0012, 0, 1);
      onSeekRatio(nextRatio);
    },
    [normalizedProgress, onSeekRatio],
  );

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!draggingRef.current || !trackRef.current || !onSeekRatio) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.height <= 0) return;
      seekRatio((event.clientY - rect.top) / rect.height);
    };

    const onPointerUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onSeekRatio, seekRatio]);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-20 z-30 pointer-events-none hidden xl:block">
      <div className="group h-full w-full flex items-center justify-end pointer-events-auto pr-3">
        <aside
          className={`pointer-events-auto rounded-2xl border backdrop-blur-sm px-2 py-2.5 transition-all duration-200 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 ${toneClass.panelBorder} ${toneClass.panelShadow}`}
          aria-label="Page navigation rail"
        >
          <div className="flex items-center gap-2">
            <div
              ref={trackRef}
              role="slider"
              aria-label="Page scroll control"
              aria-valuemin={0}
              aria-valuemax={sections.length - 1}
              aria-valuenow={activeIndex}
              className={`relative h-44 w-2.5 rounded-full overflow-hidden border border-white/14 ${toneClass.trackBg} ${onSeekRatio ? 'cursor-ns-resize' : 'cursor-pointer'}`}
              onPointerDown={(event) => {
                if (!trackRef.current) return;
                const rect = trackRef.current.getBoundingClientRect();
                const ratio = (event.clientY - rect.top) / rect.height;
                if (onSeekRatio) {
                  draggingRef.current = true;
                  seekRatio(ratio);
                  return;
                }
                const idx = clamp(Math.round(clamp(ratio, 0, 1) * (sections.length - 1)), 0, sections.length - 1);
                onJump(idx);
              }}
              onWheel={(event) => {
                if (!onSeekRatio) return;
                const now = Date.now();
                if (now - lastWheelTsRef.current < 40) return;
                lastWheelTsRef.current = now;
                event.preventDefault();
                seekByWheel(event.deltaY);
              }}
            >
              <div
                className={`absolute left-[2px] right-[2px] rounded-full bg-gradient-to-b ${toneClass.thumbBg}`}
                style={{
                  height: `${normalizedThumb}%`,
                  top: `${normalizedProgress * (100 - normalizedThumb)}%`,
                }}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              {sections.map((section, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={section.id}
                    type="button"
                    title={section.label}
                    onClick={() => onJump(index)}
                    aria-current={active ? 'true' : undefined}
                    className="h-4 w-4 rounded-full inline-flex items-center justify-center hover:bg-white/8 transition-colors"
                  >
                    <span
                      className={`rounded-full transition-all ${
                        active ? `h-2.5 w-2.5 ${toneClass.activeBullet}` : `h-2 w-2 ${toneClass.idleBullet}`
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default VerticalPageRail;

