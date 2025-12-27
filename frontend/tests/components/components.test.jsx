import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Header from '../../src/components/Header'
import Footer from '../../src/components/Footer'

describe('Header Component', () => {
    it('should render header with title', () => {
        render(
            <BrowserRouter>
                <Header />
            </BrowserRouter>
        )
        
        expect(screen.getByText(/P2P Transfer/i)).toBeDefined()
    })

    it('should render without crashing', () => {
        const { container } = render(
            <BrowserRouter>
                <Header />
            </BrowserRouter>
        )
        
        expect(container).toBeDefined()
    })
})

describe('Footer Component', () => {
    it('should render footer', () => {
        render(<Footer />)
        
        const footer = screen.getByRole('contentinfo')
        expect(footer).toBeDefined()
    })

    it('should render without crashing', () => {
        const { container } = render(<Footer />)
        expect(container).toBeDefined()
    })
})
