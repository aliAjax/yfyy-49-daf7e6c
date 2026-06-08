import { Card, Table, Button, Input, Modal, Form, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { Department } from '../../types';

function Departments() {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/system/departments', {
        params: { keyword },
      });
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDept(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    form.setFieldsValue({
      name: dept.name,
      code: dept.code,
      description: dept.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/system/departments/${id}`);
      message.success('删除成功');
      loadDepartments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingDept) {
        await api.put(`/system/departments/${editingDept.id}`, values);
        message.success('编辑成功');
      } else {
        await api.post('/system/departments', values);
        message.success('新增成功');
      }

      setModalVisible(false);
      loadDepartments();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '科室名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '科室编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Department) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该科室吗？"
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
          <Input
            placeholder="搜索科室名称/编码"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
            onPressEnter={loadDepartments}
          />
          <Button type="primary" onClick={loadDepartments}>
            搜索
          </Button>
          <Button onClick={() => { setKeyword(''); loadDepartments(); }}>
            重置
          </Button>
        </Space>
      </Card>

      <Card
        title="科室列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增科室
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={departments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingDept ? '编辑科室' : '新增科室'}
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
            name="name"
            label="科室名称"
            rules={[{ required: true, message: '请输入科室名称' }]}
          >
            <Input placeholder="请输入科室名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="科室编码"
            rules={[{ required: true, message: '请输入科室编码' }]}
          >
            <Input placeholder="请输入科室编码" />
          </Form.Item>
          <Form.Item name="description" label="科室描述">
            <Input.TextArea rows={3} placeholder="请输入科室描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Departments;
