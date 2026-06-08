import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../api';
import type { Case, ServiceItemMaterial } from '../../types';
import { getCaseMaterialList, hasCaseMaterials } from '../../utils/materials';
import CaseReceipt from '../../components/CaseReceipt';

function CaseReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [materials, setMaterials] = useState<ServiceItemMaterial[]>([]);

  useEffect(() => {
    if (id) {
      loadCaseDetail();
    }
  }, [id]);

  const loadCaseDetail = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/cases/${id}`);
      if (res.case) {
        setCaseData(res.case);
        if (hasCaseMaterials(res.case)) {
          setMaterials(getCaseMaterialList(res.case));
        }
      }
    } catch (error) {
      console.error(error);
      message.error('加载办件信息失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
        办件不存在
      </div>
    );
  }

  return (
    <div className="receipt-page">
      <div style={{ maxWidth: 880, margin: '0 auto', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
        </Space>
      </div>
      <CaseReceipt caseData={caseData} materials={materials} showHeader={false} />
      <div style={{ maxWidth: 880, margin: '0 auto', marginTop: 16, textAlign: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default CaseReceiptPage;
