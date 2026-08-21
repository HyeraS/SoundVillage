'use client'

const DIRECTIONS = [
  ['up', '▲', 'up'], ['left', '◀', 'left'], ['down', '▼', 'down'], ['right', '▶', 'right'],
]

export default function MobileControls3D({ inputRef, disabled, onInteract, interactionLabel = '소리 듣기' }) {
  const setDirection = (direction, value) => { inputRef.current[direction] = value }
  return (
    <div className="mobileControls" aria-label="이동 컨트롤">
      <div className="dpad">
        {DIRECTIONS.map(([direction, label, area]) => (
          <button
            key={direction}
            className={`dpadButton dpad-${area}`}
            aria-label={`${direction} 이동`}
            disabled={disabled}
            onPointerDown={event => { event.preventDefault(); setDirection(direction, true) }}
            onPointerUp={() => setDirection(direction, false)}
            onPointerCancel={() => setDirection(direction, false)}
            onPointerLeave={() => setDirection(direction, false)}
          >{label}</button>
        ))}
      </div>
      <button className="interactButton" disabled={disabled} onClick={onInteract}>{interactionLabel}</button>
    </div>
  )
}
