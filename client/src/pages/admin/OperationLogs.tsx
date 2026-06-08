import { Card, Table, Button, Input, Select, DatePicker, Space, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import api from '../../api';
import type { OperationLog } from '../../types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

function OperationLogs() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modules, setModules] = useState<string[]>([]);

  const [userName, setUserName] = useState('');
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    loadLogs();
    loadModules();
  }, []);

  const loadLogs = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = {
        page: p,
        pageSize: ps,
      };
      if (userName) params.user_name = userName;
      if (module) params.module = module;
      if (action) params.action = action;
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');

      const res: any = await api.get('/logs/operation-logs', { params });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setPage(p);
      setPageSize(ps);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const res: any = await api.get('/logs/operation-logs/modules');
      setModules(res.modules || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = () => {
    loadLogs(1, pageSize);
  };

  const handleReset = () => {
    setUserName('');
    setModule(undefined);
    setAction('');
    setDateRange(null);
    setTimeout(() => loadLogs(1, pageSize), 0);
  };

  const handlePageChange = (p: number, ps: number) => {
    loadLogs(p, ps);
  };

  const columns = [
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
      render: (name: string) => name || '-',
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (mod: string) => mod ? <Tag color="blue">{mod}</Tag> : '-',
    },
    {
      title: '操作动作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: '操作详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string) => ip || '-',
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="操作人姓名"
            prefix={<SearchOutlined />}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            placeholder="模块筛选"
            style={{ width: 150 }}
            value={module}
            onChange={setModule}
            allowClear
            options={modules.map((m) => ({ label: m, value: m }))}
          />
          <Input
            placeholder="操作动作"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{ width: 150 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="操作日志">
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: handlePageChange,
          }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}

export default OperationLogs;
