import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { BrowserRouter } from 'react-router-dom';
import * as AuthContext from '../context/AuthContext';
import * as router from 'react-router-dom';

// 準備 mock
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

describe('LoginPage 測試', () => {
    const mockNavigate = vi.fn();
    const mockLogin = vi.fn();
    const mockClearAuthExpiredMessage = vi.fn();

    const renderWithRouter = (component: React.ReactNode) => {
        return render(<BrowserRouter>{component}</BrowserRouter>);
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(router.useNavigate).mockReturnValue(mockNavigate);
        vi.mocked(AuthContext.useAuth).mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            authExpiredMessage: null,
            login: mockLogin,
            logout: vi.fn(),
            checkAuth: vi.fn(),
            clearAuthExpiredMessage: mockClearAuthExpiredMessage,
        });
    });

    afterEach(() => {
        // 還原環境變數
        vi.unstubAllEnvs();
    });

    describe('前端元素', () => {
        it('渲染登入頁面基本元素（標題、輸入框、按鈕）', () => {
            renderWithRouter(<LoginPage />);
            
            expect(screen.getByRole('heading', { name: '歡迎回來' })).toBeInTheDocument();
            expect(screen.getByLabelText('電子郵件')).toBeInTheDocument();
            expect(screen.getByLabelText('密碼')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
        });

        it('未設定 API URL 環境變數時顯示測試帳號提示', () => {
            vi.stubEnv('VITE_API_URL', '');
            renderWithRouter(<LoginPage />);
            
            expect(screen.getByText('測試帳號：任意 email 格式 / 密碼需包含英數且8位以上')).toBeInTheDocument();
        });
    });

    describe('function 邏輯', () => {
        it('輸入無效的 Email 格式時顯示錯誤提示', async () => {
            const user = userEvent.setup();
            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'invalid-email');
            await user.type(screen.getByLabelText('密碼'), 'Pass1234');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('請輸入有效的 Email 格式')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('密碼長度少於 8 個字元時顯示錯誤提示', async () => {
            const user = userEvent.setup();
            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'Pass1');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須至少 8 個字元')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('密碼未同時包含英文字母與數字時顯示錯誤提示', async () => {
            const user = userEvent.setup();
            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), '12345678');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須包含英文字母和數字')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });
    });

    describe('Mock API', () => {
        it('提交表單時按鈕呈現載入狀態且禁用', async () => {
            const user = userEvent.setup();
            // 讓 login promise 不要馬上 resolve，這樣我們可以斷言 loading 狀態
            let resolveLogin: (value: void | PromiseLike<void>) => void;
            const loginPromise = new Promise<void>((resolve) => {
                resolveLogin = resolve;
            });
            mockLogin.mockReturnValue(loginPromise);

            renderWithRouter(<LoginPage />);
            
            const emailInput = screen.getByLabelText('電子郵件');
            const passwordInput = screen.getByLabelText('密碼');
            const submitButton = screen.getByRole('button', { name: '登入' });

            await user.type(emailInput, 'test@example.com');
            await user.type(passwordInput, 'Pass1234');
            await user.click(submitButton);

            expect(screen.getByRole('button', { name: /登入中\.\.\./ })).toBeDisabled();
            expect(emailInput).toBeDisabled();
            expect(passwordInput).toBeDisabled();

            resolveLogin!(); // 解除 promise
            await waitFor(() => {
                expect(emailInput).not.toBeDisabled();
            });
        });

        it('帳號密碼正確時登入成功並導向至儀表板', async () => {
            const user = userEvent.setup();
            mockLogin.mockResolvedValue(undefined); // API 回傳成功

            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'Pass1234');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Pass1234');
                expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
            });
        });

        it('登入失敗時顯示 API 回傳的錯誤訊息', async () => {
            const user = userEvent.setup();
            const mockError = {
                response: {
                    data: { message: '帳號或密碼錯誤' }
                }
            };
            mockLogin.mockRejectedValue(mockError);

            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'WrongPass123');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('帳號或密碼錯誤')).toBeInTheDocument();
            });
            // 驗證載入狀態解除（按鈕恢復）
            expect(screen.getByRole('button', { name: '登入' })).not.toBeDisabled();
        });

        it('登入發生網路異常或無特定訊息時顯示預設錯誤提示', async () => {
            const user = userEvent.setup();
            mockLogin.mockRejectedValue(new Error('Network Error'));

            renderWithRouter(<LoginPage />);
            
            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'WrongPass123');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('登入失敗，請稍後再試')).toBeInTheDocument();
            });
        });
    });

    describe('驗證權限', () => {
        it('使用者已是登入狀態時造訪頁面應自動導向至儀表板', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: { id: 1, email: 'test@example.com', name: 'Test', role: 'admin' },
                token: 'mock-token',
                isLoading: false,
                isAuthenticated: true,
                authExpiredMessage: null,
                login: mockLogin,
                logout: vi.fn(),
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: mockClearAuthExpiredMessage,
            });

            renderWithRouter(<LoginPage />);

            expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        });

        it('存在憑證過期通知時顯示錯誤橫幅並清除該訊息', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                user: null,
                token: null,
                isLoading: false,
                isAuthenticated: false,
                authExpiredMessage: '登入憑證已過期，請重新登入',
                login: mockLogin,
                logout: vi.fn(),
                checkAuth: vi.fn(),
                clearAuthExpiredMessage: mockClearAuthExpiredMessage,
            });

            renderWithRouter(<LoginPage />);

            expect(screen.getByText('登入憑證已過期，請重新登入')).toBeInTheDocument();
            expect(mockClearAuthExpiredMessage).toHaveBeenCalled();
        });
    });
});
