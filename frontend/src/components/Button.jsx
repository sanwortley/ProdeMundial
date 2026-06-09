import React from 'react'

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-bold text-sm rounded-lg transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] select-none'

  const styles = {
    // Verde FIFA sólido — botón principal
    primary: {
      className: 'px-5 py-3',
      style: {
        background: '#00a651',
        color: '#fff',
      },
      hoverStyle: { background: '#009647' },
    },
    // Borde sutil oscuro
    secondary: {
      className: 'px-5 py-3',
      style: {
        background: '#1f1f1f',
        color: '#f5f5f5',
        border: '1px solid #2a2a2a',
      },
      hoverStyle: { background: '#272727', borderColor: '#3a3a3a' },
    },
    // Rojo peligro
    danger: {
      className: 'px-5 py-3',
      style: {
        background: '#e8192c',
        color: '#fff',
      },
      hoverStyle: { background: '#cc1626' },
    },
    // Sin fondo
    text: {
      className: 'px-4 py-2',
      style: { color: '#00a651' },
      hoverStyle: {},
    },
  }

  const v = styles[variant] || styles.primary

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${v.className} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={v.style}
      onMouseEnter={e => { if (!disabled && !loading) Object.assign(e.currentTarget.style, v.hoverStyle) }}
      onMouseLeave={e => { if (!disabled && !loading) Object.assign(e.currentTarget.style, v.style) }}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Procesando...</span>
        </div>
      ) : children}
    </button>
  )
}

export default Button
