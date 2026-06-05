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
  const baseStyles = 'inline-flex items-center justify-center font-semibold text-sm rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'
  
  const variants = {
    primary: 'bg-gradient-green text-soccer-dark hover:brightness-110 focus:ring-soccer-green/30 px-5 py-3 shadow-[0_4px_12px_rgba(16,185,129,0.2)]',
    secondary: 'bg-slate-800/80 border border-slate-700 text-slate-100 hover:bg-slate-700 focus:ring-slate-500/20 px-5 py-3',
    danger: 'bg-gradient-to-r from-red-600 to-rose-700 text-white hover:brightness-110 focus:ring-red-500/30 px-5 py-3 shadow-[0_4px_12px_rgba(220,38,38,0.2)]',
    text: 'text-soccer-green hover:bg-soccer-green/10 focus:ring-soccer-green/10 px-4 py-2'
  }

  const widthStyles = fullWidth ? 'w-full' : ''

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${widthStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Procesando...</span>
        </div>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
