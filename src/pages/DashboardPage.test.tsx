import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { BrowserRouter } from 'react-router-dom';
import * as AuthContext from '../context/AuthContext';
import * as router from 'react-router-dom';
import { productApi } from '../api/productApi';

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

vi.mock('../api/productApi', () => ({
    productApi: {
        getProducts: vi.fn(),
    },
}));

describe('DashboardPage 測試', () => {
    const mockNavigate = vi.fn();
    const mockLogout = vi.fn();

    const renderWithRouter = (component: React.ReactNode) => {
        return render(<BrowserRouter>{component}</BrowserRouter>);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(router.useNavigate).mockReturnValue(mockNavigate);
        
        // 預設為一般使用者
        vi.mocked(AuthContext.useAuth).mockReturnValue({
            user: { id: 2, email: 'user@example.com', name: 'User', role: 'user', username: 'tester' },
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            authExpiredMessage: null,
            login: vi.fn(),
            logout: mockLogout,
            checkAuth: vi.fn(),
            clearAuthExpiredMessage: vi.fn(),
        });
    });

    describe('前端元素', () => {
        it('渲染儀表板基本元素（標題、歡迎訊息與登出按鈕）', async () => {
            vi.mocked(productApi.getProducts).mockResolvedValue([]);
            renderWithRouter(<DashboardPage />);
            
            expect(screen.getByRole('heading', { name: '儀表板' })).toBeInTheDocument();
            expect(screen.getByText('Welcome, tester 👋')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument();
        });
    });

    describe('狀態與權限', () => {
        it('使用者為 admin 角色時顯示「管理後台」連結', async () => {
            vi.mocked(productApi.getProducts).mockResolvedValue([]);
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin', username: 'admin' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: vi.fn(),
                logout: mockLogout,
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: vi.fn(),
            });

            renderWithRouter(<DashboardPage />);

            expect(screen.getByRole('link', { name: /管理後台/ })).toBeInTheDocument();
            expect(screen.getByText('管理員')).toBeInTheDocument();
        });

        it('使用者為非 admin 角色時隱藏「管理後台」連結', async () => {
            vi.mocked(productApi.getProducts).mockResolvedValue([]);
            renderWithRouter(<DashboardPage />);

            expect(screen.queryByRole('link', { name: /管理後台/ })).not.toBeInTheDocument();
            expect(screen.getByText('一般用戶')).toBeInTheDocument();
        });
    });

    describe('Mock API', () => {
        it('組件掛載時顯示載入中狀態並發起商品資料請求', () => {
            // 讓 promise 懸空保持 loading 狀態
            let resolveProducts: (value: any) => void;
            const promise = new Promise((resolve) => {
                resolveProducts = resolve;
            });
            vi.mocked(productApi.getProducts).mockReturnValue(promise as any);

            renderWithRouter(<DashboardPage />);

            expect(screen.getByText('載入商品中...')).toBeInTheDocument();
            expect(productApi.getProducts).toHaveBeenCalled();
            resolveProducts!([]);
        });

        it('商品資料請求成功時渲染商品列表', async () => {
            const mockProducts = [
                { id: 1, name: '商品A', description: '描述A', price: 100 },
                { id: 2, name: '商品B', description: '描述B', price: 200 },
            ];
            vi.mocked(productApi.getProducts).mockResolvedValue(mockProducts);

            renderWithRouter(<DashboardPage />);

            await waitFor(() => {
                expect(screen.queryByText('載入商品中...')).not.toBeInTheDocument();
            });

            expect(screen.getByText('商品A')).toBeInTheDocument();
            expect(screen.getByText('描述A')).toBeInTheDocument();
            expect(screen.getByText('NT$ 100')).toBeInTheDocument();
            
            expect(screen.getByText('商品B')).toBeInTheDocument();
            expect(screen.getByText('描述B')).toBeInTheDocument();
            expect(screen.getByText('NT$ 200')).toBeInTheDocument();
        });

        it('商品資料請求失敗且非 401 時顯示錯誤訊息', async () => {
            const mockError = {
                response: {
                    status: 500,
                    data: { message: '伺服器異常' }
                }
            };
            vi.mocked(productApi.getProducts).mockRejectedValue(mockError);

            renderWithRouter(<DashboardPage />);

            await waitFor(() => {
                expect(screen.getByText('伺服器異常')).toBeInTheDocument();
            });
            expect(screen.queryByText('載入商品中...')).not.toBeInTheDocument();
        });

        it('商品資料請求回傳 401 時不顯示錯誤由攔截器處理', async () => {
            const mockError = {
                response: {
                    status: 401,
                    data: { message: '未授權' }
                }
            };
            vi.mocked(productApi.getProducts).mockRejectedValue(mockError);

            renderWithRouter(<DashboardPage />);

            await waitFor(() => {
                // 不會設定錯誤訊息，且載入狀態解除
                expect(screen.queryByText('載入商品中...')).not.toBeInTheDocument();
            });
            
            // 畫面上不該出現"未授權"或"無法載入商品資料"
            expect(screen.queryByText('未授權')).not.toBeInTheDocument();
            expect(screen.queryByText('無法載入商品資料')).not.toBeInTheDocument();
        });
    });

    describe('function 邏輯', () => {
        it('點擊登出按鈕時觸發登出邏輯並導向登入頁', async () => {
            const user = userEvent.setup();
            vi.mocked(productApi.getProducts).mockResolvedValue([]);
            renderWithRouter(<DashboardPage />);

            await user.click(screen.getByRole('button', { name: '登出' }));

            expect(mockLogout).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: null });
        });
    });
});
