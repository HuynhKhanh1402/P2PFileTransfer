import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()
  
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-[960px] mx-auto px-3 sm:px-6 lg:px-10 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 shrink-0">
            <div className="size-8 sm:size-10 rounded-lg bg-primary flex items-center justify-center text-black shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <span className="material-symbols-outlined text-xl sm:text-2xl">swap_horiz</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-text-main truncate">P2P Transfer</h2>
          </Link>
          
          {/* Right Menu */}
          <div className="flex items-center gap-2 sm:gap-6 lg:gap-8">
            <div className="hidden md:flex items-center gap-6">
              <Link 
                to="/" 
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === '/' ? 'text-primary' : 'text-text-main hover:text-primary'
                }`}
              >
                Send
              </Link>
              <Link 
                to="/receive" 
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === '/receive' ? 'text-primary' : 'text-text-main hover:text-primary'
                }`}
              >
                Receive
              </Link>
            </div>
            <Link 
              to="/receive"
              className="bg-gray-100 hover:bg-gray-200 text-text-main text-xs sm:text-sm font-bold h-8 sm:h-10 px-3 sm:px-5 rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base sm:text-lg">download</span>
              <span className="hidden xs:inline sm:inline">Receive</span>
              <span className="hidden sm:inline"> Files</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
