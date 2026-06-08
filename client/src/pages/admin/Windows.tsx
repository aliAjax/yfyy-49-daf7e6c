import { Card, Table, Button, Select, Modal, Form, Input, message, Popconfirm, Space, Tag, Switch } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { Window, Department } from '../../types';

function Windows() {
  const [loading, setLoading] = useState(false);
  const [windows, setWindows] = useState<Window[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWindow, setEditingWindow] = useState<Window | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadWindows();
    loadDepartments();
  }, []);

  useEffect(() => {
    loadWindows();
  }, [departmentId]);

  const loadWindows = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/system/windows', {
        params: { department_id: departmentId || undefined },
      });
      setWindows(res.windows || []);
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
    setEditingWindow(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (win: Window) => {
    setEditingWindow(win);
    form.setFieldsValue({
      name: win.name,
      number: win.number,
      department_id: win.department_id,
      type: win.type,
      status: win.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/system/windows/${id}`);
      message.success('删除成功');
      loadWindows();
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleStatus = async (win: Window) => {
    try {
      const newStatus = win.status === 'open' ? 'closed' : 'open';
      await api.put(`/system/windows/${win.id}`, {
        ...win,
        status: newStatus,
      });
      message.success(newStatus === 'open' ? '已启用' : '已停用');
      loadWindows();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingWindow) {
        await api.put(`/system/windows/${editingWindow.id}`, values);
        message.success('编辑成功');
      } else {
        await api.post('/system/windows', values);
        message.success('新增成功');
      }

      setModalVisible(false);
      loadWindows();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeText = (type: string) => {
    return type === 'comprehensive' ? '综合窗口' : '专业窗口';
  };

  const getTypeColor = (type: string) => {
    return type === 'comprehensive' ? 'blue' : 'green';
  };

  const columns = [
    {
      title: '窗口编号',
      dataIndex: 'number',
      key: 'number',
      width: 120,
    },
    {
      title: '窗口名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>{getTypeText(type)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'open' ? 'green' : 'default'}>
          {status === 'open' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: Window) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Switch
            size="small"
            checked={record.status === 'open'}
            onChange={() => handleToggleStatus(record)}
          />
          <Popconfirm
            title="确定删除该窗口吗？"
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
        <Space size={16}>
          <Select
            placeholder="按科室筛选"
            value={departmentId || undefined}
            onChange={setDepartmentId}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {departments.map((dept) => (
              <Select.Option key={dept.id} value={dept.id}>
                {dept.name}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={loadWindows} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={() => { setDepartmentId(''); }}>
            重置
          </Button>
        </Space>
      </Card>

      <Card
        title="窗口列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增窗口
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={windows}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingWindow ? '编辑窗口' : '新增窗口'}
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
        width={500}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="number"
            label="窗口编号"
            rules={[{ required: true, message: '请输入窗口编号' }]}
          >
            <Input placeholder="请输入窗口编号，如：01" />
          </Form.Item>
          <Form.Item
            name="name"
            label="窗口名称"
            rules={[{ required: true, message: '请输入窗口名称' }]}
          >
            <Input placeholder="请输入窗口名称" />
          </Form.Item>
          <Form.Item
            name="department_id"
            label="所属科室"
          >
            <Select placeholder="请选择科室" allowClear showSearch optionFilterProp="children">
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="type"
            label="窗口类型"
            rules={[{ required: true, message: '请选择窗口类型' }]}
          >
            <Select placeholder="请选择窗口类型">
              <Select.Option value="comprehensive">综合窗口</Select.Option>
              <Select.Option value="professional">专业窗口</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            initialValue="open"
          >
            <Select placeholder="请选择状态">
              <Select.Option value="open">启用</Select.Option>
              <Select.Option value="closed">停用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Windows;
