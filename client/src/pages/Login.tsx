import { Form, Input, Button, Card, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useState } from 'react';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username: string, password: string) => {
    handleLogin({ username, password });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-title">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
          统一政务服务大厅管理系统
        </div>
        <Tabs
          defaultActiveKey="account"
          centered
          items={[
            {
              key: 'account',
              label: '账号密码登录',
            },
          ]}
        />
        <Form
          name="login"
          onFinish={handleLogin}
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              style={{ width: '100%' }}
              loading={loading}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <Card size="small" title="快速登录（测试账号）" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button size="small" onClick={() => quickLogin('admin', '123456')}>
              管理员
            </Button>
            <Button size="small" onClick={() => quickLogin('window01', '123456')}>
              窗口员
            </Button>
            <Button size="small" onClick={() => quickLogin('approver01', '123456')}>
              审批员
            </Button>
            <Button size="small" onClick={() => quickLogin('citizen01', '123456')}>
              群众
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Login;
