import { Card, Table, Tag, Input, Select, Space, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import type { Case } from '../../types';
import { CaseStatusText } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;

function CitizenCases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadCases();
  }, [status, keyword, pagination.current, pagination.pageSize]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/cases/my', {
        params: {
          status,
          keyword: keyword || undefined,
          page: pagination.current,
          pageSize: pagination.pageSize,
        },
      });
      setCases(res.cases || []);
      setPagination((prev) => ({ ...prev, total: res.total || 0 }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    loadCases();
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'default',
      submitted: 'blue',
      material_reviewing: 'orange',
      material_correction: 'warning',
      accepting: 'processing',
      reviewing: 'processing',
      cross_department: 'purple',
      approved: 'success',
      rejected: 'error',
      completed: 'success',
    };
    return colorMap[status] || 'default';
  };

  const columns = [
    {
      title: '办件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 180,
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: '服务事项',
      dataIndex: 'service_item_name',
      key: 'service_item_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {CaseStatusText[status as keyof typeof CaseStatusText]}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <Card
        title="我的办件"
        extra={
          <Space>
            <Input
              placeholder="搜索办件编号或服务事项"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder="按状态筛选"
              style={{ width: 150 }}
              value={status}
              onChange={(val) => {
                setStatus(val);
                setPagination((prev) => ({ ...prev, current: 1 }));
              }}
              allowClear
            >
              <Option value="draft">草稿</Option>
              <Option value="submitted">已提交</Option>
              <Option value="material_reviewing">材料审核中</Option>
              <Option value="material_correction">材料需补正</Option>
              <Option value="accepting">受理中</Option>
              <Option value="reviewing">审批中</Option>
              <Option value="cross_department">跨科室流转中</Option>
              <Option value="approved">审批通过</Option>
              <Option value="rejected">审批驳回</Option>
              <Option value="completed">已办结</Option>
            </Select>
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={cases}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            }}
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onClick: () => navigate(`/citizen/cases/${record.id}`),
            })}
          />
        </Spin>
      </Card>
    </div>
  );
}

export default CitizenCases;
