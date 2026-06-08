import { Card, Table, Button, Input, Select, Modal, Form, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { User, Department, UserRole } from '../../types';
import { RoleText } from '../../types';

function Users() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<UserRole | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [resetPwdVisible, setResetPwdVisible] = useState(false);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [resetPwdForm] = Form.useForm();

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/system/users', {
        params: { keyword, role, department_id: departmentId, status },
      });
      setUsers(res.users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res: any = await api.get('/system/departments');
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', role: 'window' });
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      phone: user.phone,
      email: user.email,
      status: user.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/system/users/${id}`);
      message.success('删除成功');
      loadUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await api.patch(`/system/users/${user.id}/status`, { status: newStatus });
      message.success('状态更新成功');
      loadUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetPassword = (user: User) => {
    setEditingUser(user);
    resetPwdForm.resetFields();
    setResetPwdVisible(true);
  };

  const handleSubmitResetPwd = async () => {
    try {
      const values = await resetPwdForm.validateFields();
      setResettingPwd(true);
      await api.post(`/system/users/${editingUser?.id}/reset-password`, {
        password: values.password,
      });
      message.success('密码重置成功');
      setResetPwdVisible(false);
    } catch (error) {
      console.error(error);
    } finally {
      setResettingPwd(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingUser) {
        await api.put(`/system/users/${editingUser.id}`, values);
        message.success('编辑成功');
      } else {
        await api.post('/system/users', values);
        message.success('新增成功');
      }

      setModalVisible(false);
      loadUsers();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions: Array<{ label: string; value: UserRole }> = [
    { label: '系统管理员', value: 'admin' },
    { label: '窗口工作人员', value: 'window' },
    { label: '审批人员', value: 'approver' },
    { label: '办事群众', value: 'citizen' },
  ];

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: UserRole) => <Tag color="blue">{RoleText[role]}</Tag>,
    },
    {
      title: '所属科室',
      dataIndex: 'department_id',
      key: 'department_id',
      width: 120,
      render: (_: string, record: User) => {
        const dept = departments.find((d) => d.id === record.department_id);
        return dept?.name || '-';
      },
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleToggleStatus(record)}>
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleResetPassword(record)}>
            重置密码
          </Button>
          <Popconfirm
            title="确定删除该用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="搜索用户名/姓名"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="角色筛选"
            style={{ width: 150 }}
            value={role}
            onChange={setRole}
            allowClear
            options={roleOptions}
          />
          <Select
            placeholder="科室筛选"
            style={{ width: 180 }}
            value={departmentId}
            onChange={setDepartmentId}
            allowClear
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 130 }}
            value={status}
            onChange={setStatus}
            allowClear
            options={[
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'inactive' },
            ]}
          />
          <Button type="primary" onClick={loadUsers}>
            搜索
          </Button>
          <Button
            onClick={() => {
              setKeyword('');
              setRole(undefined);
              setDepartmentId(undefined);
              setStatus(undefined);
              loadUsers();
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      <Card
        title="用户列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增用户
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
            确定
          </Button>,
        ]}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="username"
              label="用户名"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" disabled={!!editingUser} />
            </Form.Item>
            <Form.Item
              name="name"
              label="姓名"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
          </div>
          {!editingUser && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[{ required: true, message: '请输入初始密码' }]}
            >
              <Input.Password placeholder="请输入初始密码" />
            </Form.Item>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="role"
              label="角色"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select placeholder="请选择角色" options={roleOptions} />
            </Form.Item>
            <Form.Item name="department_id" label="所属科室" style={{ flex: 1 }}>
              <Select
                placeholder="请选择科室"
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
                allowClear
              />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="phone" label="手机号" style={{ flex: 1 }}>
              <Input placeholder="请输入手机号" />
            </Form.Item>
            <Form.Item name="email" label="邮箱" style={{ flex: 1 }}>
              <Input placeholder="请输入邮箱" />
            </Form.Item>
          </div>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="请选择状态"
              options={[
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={resetPwdVisible}
        onCancel={() => setResetPwdVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setResetPwdVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={resettingPwd} onClick={handleSubmitResetPwd}>
            确定
          </Button>,
        ]}
        width={400}
        destroyOnClose
      >
        <Form form={resetPwdForm} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Users;
