import React from 'react'

const Input = ({
  label,
  id,
  type = 'text',
  error,
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`w-full px-4 py-3 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200 text-sm ${
          error
            ? 'border border-red-500/60 focus:border-red-500'
            : 'focus:border-wc-green/60'
        }`}
        style={{
          background: 'rgba(5, 18, 8, 0.8)',
          border: error ? undefined : '1px solid rgba(255,255,255,0.08)',
        }}
        {...props}
      />
      {error && (
        <span className="text-xs font-medium text-red-400 mt-0.5">
          {error}
        </span>
      )}
    </div>
  )
}

export default Input

