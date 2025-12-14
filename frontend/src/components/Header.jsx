import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()
  
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-[960px] mx-auto px-4 sm:px-10 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-black shadow-sm group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">swap_horiz</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-text-main">P2P Transfer</h2>
          </Link>
          
          {/* Right Menu */}
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="hidden sm:flex items-center gap-6">
              <Link 
                to="/" 
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/' ? 'text-primary' : 'text-text-main hover:text-primary'
                }`}
              >
                Send
              </Link>
              <Link 
                to="/receive" 
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/receive' ? 'text-primary' : 'text-text-main hover:text-primary'
                }`}
              >
                Receive
              </Link>
            </div>
            <Link 
              to="/receive"
              className="bg-gray-100 hover:bg-gray-200 text-text-main text-sm font-bold h-10 px-5 rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">Receive Files</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
