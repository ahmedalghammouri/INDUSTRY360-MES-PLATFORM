export default function PlatformLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 bg-background">
      {/* Logo + spinner */}
      <div className="relative w-16 h-16">
        {/* Outer spinning ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#6366f1',
            borderRightColor: '#a78bfa',
            animation: 'spin 0.85s linear infinite',
          }}
        />
        {/* Inner reverse ring */}
        <div
          className="absolute inset-[7px] rounded-full"
          style={{
            border: '1.5px solid transparent',
            borderBottomColor: '#60a5fa',
            animation: 'spin 1.3s linear infinite reverse',
          }}
        />
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="STAR-MES"
          className="absolute inset-[3px] rounded-xl object-cover"
        />
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="font-bold text-sm tracking-wide"
          style={{
            background: 'linear-gradient(90deg,#818cf8,#a78bfa,#60a5fa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          STAR-MES
        </span>
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}
