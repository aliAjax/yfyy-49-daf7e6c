import { Card, Form, Input, Button, message, Spin, Tabs, Row, Col, Empty, Tag } from 'antd';
import { UserOutlined, LockOutlined, StarFilled, StarOutlined, CalendarOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuthStore } from '../../store/auth';
import { useFavoriteStore } from '../../store/favorite';
import dayjs from 'dayjs';
import type { ServiceItem } from '../../types';

const { TabPane } = Tabs;

function CitizenProfile() {
  const navigate = useNavigate();
  const { user, loadUser } = useAuthStore();
  const { favorites, loading: favoritesLoading, removeFavorite } = useFavoriteStore();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        name: user.name,
        phone: user.phone,
        email: user.email,
      });
    }
  }, [user]);

  const handleRemoveFavorite = async (service: ServiceItem) => {
    setRemoveLoading(service.id);
    try {
      await removeFavorite(service.id);
      message.success('已取消收藏');
    } catch (error) {
      console.error(error);
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const values = await profileForm.validateFields();
      setProfileSubmitting(true);

      await api.put('/auth/profile', values);

      message.success('个人信息修改成功');
      loadUser();
    } catch (error: any) {
        if (error.errorFields) {
        return;
      }
      console.error(error);
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);

      await api.post('/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });

      message.success('密码修改成功，请重新登录');
      passwordForm.resetFields();
      
      setTimeout(() => {
        const { logout } = useAuthStore.getState();
        logout();
        navigate('/login');
      }, 1500);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      console.error(error);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Card title="个人中心" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 0' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#1677ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              marginRight: 24,
            }}
          >
            {user.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 style={{ margin: 0, marginBottom: 8 }}>{user.name}</h2>
            <p style={{ color: '#666', margin: 0, marginBottom: 4 }}>
              用户名：{user.username}
            </p>
            <p style={{ color: '#666', margin: 0 }}>
              注册时间：{dayjs(user.created_at).format('YYYY-MM-DD')}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <Tabs defaultActiveKey="1">
          <TabPane
          tab={
            <span>
              <UserOutlined />
              个人信息
            </span>
          }
          key="1"
        >
          <Form
            form={profileForm}
            layout="vertical"
            style={{ maxWidth: 500 }}
          >
            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="请输入邮箱" />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                onClick={handleUpdateProfile}
                loading={profileSubmitting}
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

          <TabPane
            tab={
              <span>
                <LockOutlined />
                修改密码
              </span>
            }
            key="2"
          >
            <Form
              form={passwordForm}
              layout="vertical"
              style={{ maxWidth: 500 }}
            >
              <Form.Item
                name="oldPassword"
                label="原密码"
                rules={[{ required: true, message: '请输入原密码' }]}
              >
                <Input.Password placeholder="请输入原密码" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度不能少于6位' },
                ]}
              >
                <Input.Password placeholder="请输入新密码（至少6位）" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  onClick={handleChangePassword}
                  loading={passwordSubmitting}
                >
                  确认修改
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane
            tab={
              <span>
                <StarFilled style={{ color: '#faad14' }} />
                我的收藏
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {favorites.length}
                </Tag>
              </span>
            }
            key="3"
          >
            <Spin spinning={favoritesLoading}>
              {favorites.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {favorites.map((item) => (
                    <Col span={8} key={item.id}>
                      <Card
                        hoverable
                        className="service-card"
                        title={item.name}
                        extra={<span style={{ fontSize: 12, color: '#999' }}>{item.code}</span>}
                        actions={[
                          <Button
                            key="detail"
                            type="text"
                            icon={<InfoCircleOutlined />}
                            onClick={() => navigate(`/citizen/services?item=${item.id}`)}
                          >
                            查看详情
                          </Button>,
                          <Button
                            key="appointment"
                            type="text"
                            icon={<CalendarOutlined />}
                            onClick={() => navigate(`/citizen/services?item=${item.id}`)}
                          >
                            立即预约
                          </Button>,
                          <Button
                            key="unfavorite"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            loading={removeLoading === item.id}
                            onClick={() => handleRemoveFavorite(item)}
                          >
                            取消收藏
                          </Button>,
                        ]}
                      >
                        <div style={{ minHeight: 60, marginBottom: 12 }}>
                          <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6 }}>
                            {item.description || '暂无描述'}
                          </p>
                        </div>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                          <span>办理科室：{item.department_name}</span>
                          <br />
                          <span>办理时限：{item.processing_time || '3'} 个工作日</span>
                          <br />
                          <span>费用：{item.fee ? `¥${item.fee}` : '免费'}</span>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <div style={{ padding: '40px 0' }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无收藏的服务事项"
                  >
                    <Button
                      type="primary"
                      icon={<StarOutlined />}
                      onClick={() => navigate('/citizen/services')}
                    >
                      去收藏常用事项
                    </Button>
                  </Empty>
                </div>
              )}
            </Spin>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

export default CitizenProfile;
