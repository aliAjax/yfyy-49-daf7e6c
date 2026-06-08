import { Card, Table, Input, Select, DatePicker, Button, Space, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../api';
import type { OperationLog } from '../../types';

const { RangePicker } = DatePicker;

function OperationLogs() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [operator, setOperator] = useState('');
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, pageSize]);

  const buildParams = (nextPage = page, nextPageSize = pageSize) => {
    const params: any = {
      page: nextPage,
      pageSize: nextPageSize,
    };

    if (operator) params.operator = operator;
    if (module) params.module = module;
    if (action) params.action = action;
    if (dateRange?.[0] && dateRange?.[1]) {
      params.start_date = dateRange[0].format('YYYY-MM-DD');
      params.end_date = dateRange[1].format('YYYY-MM-DD');
    }

    return params;
  };

  const loadModules = async () => {
    try {
      const res: any = await api.get('/logs/operation-logs/modules');
      setModules(res.modules || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadLogs = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      const res: any = await api.get('/logs/operation-logs', {
        params: buildParams(nextPage, nextPageSize),
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setPage(res.page || nextPage);
      setPageSize(res.pageSize || nextPageSize);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadLogs(1, pageSize);
  };

  const handleReset = () => {
    setOperator('');
    setModule(undefined);
    setAction('');
    setDateRange(null);
    setPage(1);
    loadLogs(1, pageSize);
  };

  const columns = [
    {
      title: '操作人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 130,
      render: (text: string) => text || '-',
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 130,
      render: (text: string) => (text ? <Tag color="blue">{text}</Tag> : '-'),
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 140,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (text: string) => text || '-',
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input
            placeholder="搜索操作人"
            prefix={<SearchOutlined />}
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            placeholder="模块筛选"
            value={module}
            onChange={setModule}
            style={{ width: 160 }}
            options={modules.map((item) => ({ label: item, value: item }))}
            allowClear
          />
          <Input
            placeholder="搜索动作"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 180 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(values) => setDateRange(values)}
            style={{ width: 260 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="操作日志">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>
    </div>
  );
}

export default OperationLogs;
