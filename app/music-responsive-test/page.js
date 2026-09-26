export default function MusicResponsiveTestPage() {
  const frame = (label, width, height) => (
    <section style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <strong style={{ color: '#f7f1e7', fontFamily: 'sans-serif' }}>{label} · {width}×{height}</strong>
      <iframe
        title={label}
        src="/music-test"
        width={width}
        height={height}
        style={{ border: '2px solid #efb15b', background: '#07152f' }}
      />
    </section>
  )

  return (
    <main style={{
      minHeight: '100vh', padding: 20, background: '#07152f',
      display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'start', justifyContent: 'center',
    }}>
      {frame('mobile portrait', 390, 640)}
      {frame('mobile landscape', 720, 390)}
    </main>
  )
}
