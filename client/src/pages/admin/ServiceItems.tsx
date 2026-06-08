import { Card, Table, Button, Input, Select, Modal, Form, InputNumber, Switch, message, Popconfirm, Space, Tag, List } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UpOutlined, DownOutlined, FileTextOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { ServiceItem, Department, Window, ServiceItemMaterial } from '../../types';

function ServiceItems() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [currentServiceItem, setCurrentServiceItem] = useState<ServiceItem | null>(null);
  const [materials, setMaterials] = useState<ServiceItemMaterial[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialFormVisible, setMaterialFormVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ServiceItemMaterial | null>(null);
  const [materialForm] = Form.useForm();
  const [materialSubmitting, setMaterialSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
    loadDepartments();
    loadWindows();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/service/service-items', {
        params: { keyword, department_id: departmentId, status },
      });
      setItems(res.items || []);
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

  const loadWindows = async () => {
    try {
      const res: any = await api.get('/system/windows');
      setWindows(res.windows || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', sort_order: 0 });
    setModalVisible(true);
  };

  const handleEdit = (item: ServiceItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      department_id: item.department_id,
      window_id: item.window_id,
      description: item.description,
      materials: item.materials,
      processing_time: item.processing_time,
      fee: item.fee,
      status: item.status,
      sort_order: item.sort_order,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/service/service-items/${id}`);
      message.success('删除成功');
      loadItems();
    } catch (error) {
      console.error(error);
    }
  };

  const openMaterialConfig = async (item: ServiceItem) => {
    setCurrentServiceItem(item);
    setMaterialModalVisible(true);
    await loadMaterials(item.id);
  };

  const loadMaterials = async (serviceItemId: string) => {
    setMaterialLoading(true);
    try {
      const res: any = await api.get(`/service/service-items/${serviceItemId}/materials`);
      setMaterials(res.materials || []);
    } catch (error) {
      console.error(error);
    } finally {
      setMaterialLoading(false);
    }
  };

  const handleAddMaterial = () => {
    setEditingMaterial(null);
    materialForm.resetFields();
    materialForm.setFieldsValue({ is_required: true, sort_order: materials.length });
    setMaterialFormVisible(true);
  };

  const handleEditMaterial = (material: ServiceItemMaterial) => {
    setEditingMaterial(material);
    materialForm.setFieldsValue({
      name: material.name,
      is_required: !!material.is_required,
      description: material.description,
      example: material.example,
      sort_order: material.sort_order,
    });
    setMaterialFormVisible(true);
  };

  const handleSaveMaterial = async () => {
    try {
      const values = await materialForm.validateFields();
      setMaterialSubmitting(true);

      if (editingMaterial) {
        await api.put(`/service/service-item-materials/${editingMaterial.id}`, {
          ...values,
          is_required: values.is_required ? 1 : 0,
        });
        message.success('编辑成功');
      } else {
        await api.post(`/service/service-items/${currentServiceItem?.id}/materials`, {
          ...values,
          is_required: values.is_required ? 1 : 0,
        });
        message.success('新增成功');
      }

      setMaterialFormVisible(false);
      if (currentServiceItem) {
        await loadMaterials(currentServiceItem.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setMaterialSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await api.delete(`/service/service-item-materials/${id}`);
      message.success('删除成功');
      if (currentServiceItem) {
        await loadMaterials(currentServiceItem.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const moveMaterial = async (index: number, direction: 'up' | 'down') => {
    const newMaterials = [...materials];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newMaterials.length) return;

    [newMaterials[index], newMaterials[targetIndex]] = [newMaterials[targetIndex], newMaterials[index]];
    
    const updatedMaterials = newMaterials.map((m, i) => ({ ...m, sort_order: i }));
    setMaterials(updatedMaterials);

    try {
      await api.post(`/service/service-items/${currentServiceItem?.id}/materials/sort`, {
        materials: updatedMaterials.map((m) => ({ id: m.id, sort_order: m.sort_order })),
      });
    } catch (error) {
      console.error(error);
      setMaterials(materials);
    }
  };

  const handleToggleStatus = async (item: ServiceItem) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await api.patch(`/service/service-items/${item.id}/status`, { status: newStatus });
      message.success('状态更新成功');
      loadItems();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingItem) {
        await api.put(`/service/service-items/${editingItem.id}`, values);
        message.success('编辑成功');
      } else {
        await api.post('/service/service-items', values);
        message.success('新增成功');
      }

      setModalVisible(false);
      loadItems();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '事项名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '事项编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '所属科室',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '所属窗口',
      dataIndex: 'window_name',
      key: 'window_name',
      width: 120,
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
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: any, record: ServiceItem) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openMaterialConfig(record)}>
            材料配置
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleToggleStatus(record)}>
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确定删除该事项吗？"
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
            placeholder="搜索事项名称/编码"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="选择科室"
            style={{ width: 180 }}
            value={departmentId}
            onChange={setDepartmentId}
            allowClear
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 140 }}
            value={status}
            onChange={setStatus}
            allowClear
            options={[
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'inactive' },
            ]}
          />
          <Button type="primary" onClick={loadItems}>
            搜索
          </Button>
          <Button onClick={() => { setKeyword(''); setDepartmentId(undefined); setStatus(undefined); loadItems(); }}>
            重置
          </Button>
        </Space>
      </Card>

      <Card
        title="服务事项列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增事项
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑服务事项' : '新增服务事项'}
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
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="事项名称"
            rules={[{ required: true, message: '请输入事项名称' }]}
          >
            <Input placeholder="请输入事项名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="事项编码"
            rules={[{ required: true, message: '请输入事项编码' }]}
          >
            <Input placeholder="请输入事项编码" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              name="department_id"
              label="所属科室"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择科室' }]}
            >
              <Select
                placeholder="请选择科室"
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
              />
            </Form.Item>
            <Form.Item
              name="window_id"
              label="所属窗口"
              style={{ flex: 1 }}
            >
              <Select
                placeholder="请选择窗口"
                options={windows.map((w) => ({ label: w.name, value: w.id }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="description" label="事项描述">
            <Input.TextArea rows={3} placeholder="请输入事项描述" />
          </Form.Item>
          <Form.Item
            name="materials"
            label="所需材料（旧格式）"
            help="推荐使用列表操作列的「材料配置」功能维护结构化材料清单，本字段仅用于兼容旧数据"
          >
            <Input.TextArea rows={2} placeholder="请输入所需材料（JSON格式，兼容旧数据）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="processing_time" label="办理时限（工作日）" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入办理时限" />
            </Form.Item>
            <Form.Item name="fee" label="费用（元）" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入费用" />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="sort_order" label="排序" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入排序" />
            </Form.Item>
            <Form.Item name="status" label="状态" valuePropName="checked" style={{ flex: 1 }}>
              <Switch
                checkedChildren="启用"
                unCheckedChildren="禁用"
                checked={form.getFieldValue('status') === 'active'}
                onChange={(checked) => form.setFieldsValue({ status: checked ? 'active' : 'inactive' })}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`材料清单配置 - ${currentServiceItem?.name}`}
        open={materialModalVisible}
        onCancel={() => setMaterialModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMaterialModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMaterial}>
            新增材料
          </Button>
        </div>
        <List
          loading={materialLoading}
          dataSource={materials}
          locale={{ emptyText: '暂无材料，请点击上方按钮添加' }}
          renderItem={(item, index) => (
            <List.Item
              key={item.id}
              actions={[
                <Button
                  key="up"
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveMaterial(index, 'up')}
                >
                  上移
                </Button>,
                <Button
                  key="down"
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  disabled={index === materials.length - 1}
                  onClick={() => moveMaterial(index, 'down')}
                >
                  下移
                </Button>,
                <Button key="edit" type="text" size="small" onClick={() => handleEditMaterial(item)}>
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确定删除该材料吗？"
                  onConfirm={() => handleDeleteMaterial(item.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="text" size="small" danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {item.name}
                    {item.is_required ? (
                      <Tag color="red" style={{ marginLeft: 8 }}>必填</Tag>
                    ) : (
                      <Tag color="default" style={{ marginLeft: 8 }}>选填</Tag>
                    )}
                  </span>
                }
                description={
                  <div>
                    {item.description && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: '#666' }}>说明：</span>
                        {item.description}
                      </div>
                    )}
                    {item.example && (
                      <div>
                        <span style={{ color: '#666' }}>示例：</span>
                        {item.example}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={editingMaterial ? '编辑材料' : '新增材料'}
        open={materialFormVisible}
        onCancel={() => setMaterialFormVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setMaterialFormVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={materialSubmitting} onClick={handleSaveMaterial}>
            确定
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        <Form form={materialForm} layout="vertical">
          <Form.Item
            name="name"
            label="材料名称"
            rules={[{ required: true, message: '请输入材料名称' }]}
          >
            <Input placeholder="请输入材料名称" />
          </Form.Item>
          <Form.Item
            name="is_required"
            label="是否必交"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="description" label="材料说明">
            <Input.TextArea rows={2} placeholder="请输入材料说明" />
          </Form.Item>
          <Form.Item name="example" label="示例说明">
            <Input.TextArea rows={2} placeholder="请输入示例说明" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入排序值，数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ServiceItems;
