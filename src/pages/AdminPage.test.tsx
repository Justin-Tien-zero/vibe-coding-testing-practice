import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPage } from './AdminPage';
import { BrowserRouter } from 'react-router-dom';
import * as AuthContext from '../context/AuthContext';
import * as router from 'react-router-dom';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

describe('AdminPage 測試', () => {
    const mockNavigate = vi.fn();
    const mockLogout = vi.fn();

    const renderWithRouter = (component: React.ReactNode) => {
        return render(<BrowserRouter>{component}</BrowserRouter>);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(router.useNavigate).mockReturnValue(mockNavigate);
    });

    describe('前端元素', () => {
        it('渲染管理後台基本元素（標題、返回按鈕與說明文字）', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: vi.fn(),
                logout: mockLogout,
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: vi.fn(),
            });

            renderWithRouter(<AdminPage />);

            expect(screen.getByRole('heading', { name: /管理後台/ })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /返回/ })).toBeInTheDocument();
            expect(screen.getByText('管理員專屬頁面')).toBeInTheDocument();
        });

        it('根據使用者角色顯示對應徽章文字', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: vi.fn(),
                logout: mockLogout,
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: vi.fn(),
            });

            renderWithRouter(<AdminPage />);
            expect(screen.getByText('管理員')).toBeInTheDocument();
        });

        it('當非 admin 角色時顯示一般用戶徽章', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 2, email: 'user@example.com', name: 'User', role: 'user' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: vi.fn(),
                logout: mockLogout,
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: vi.fn(),
            });

            renderWithRouter(<AdminPage />);
            expect(screen.getByText('一般用戶')).toBeInTheDocument();
        });
    });

    describe('function 邏輯', () => {
        it('點擊登出按鈕時觸發登出邏輯並導向登入頁', async () => {
            const user = userEvent.setup();
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: vi.fn(),
                logout: mockLogout,
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: vi.fn(),
            });

            renderWithRouter(<AdminPage />);
            
            await user.click(screen.getByRole('button', { name: '登出' }));

            expect(mockLogout).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: null });
        });
    });
});
