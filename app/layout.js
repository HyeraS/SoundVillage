import './globals.css'

export const metadata = {
  title: 'SoundMimic Village',
  description: '소리를 탐험하고 표현하는 마을',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}