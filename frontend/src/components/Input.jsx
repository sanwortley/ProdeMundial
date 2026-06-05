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
        <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`w-full px-4 py-3 bg-slate-900/60 border ${
          error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-800 focus:border-soccer-green focus:ring-soccer-green/20'
        } rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-4 transition-all duration-200 text-sm`}
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
