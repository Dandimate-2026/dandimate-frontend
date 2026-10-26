/** @param {{ children: import('react').ReactNode }} props */
function GlobalLayout({ children }) {
  return (
    <div
      className="min-h-dvh w-full bg-[#f3f3f3] font-sans text-base leading-relaxed
        text-slate-900 antialiased [font-synthesis:none]
        [-webkit-text-size-adjust:100%] [text-size-adjust:100%]
        [&_input]:text-base [&_select]:text-base [&_textarea]:text-base"
    >
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white
          pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)]
          pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]"
      >
        {children}
      </div>
    </div>
  )
}

export default GlobalLayout
