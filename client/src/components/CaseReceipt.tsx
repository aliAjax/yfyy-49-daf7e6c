import { Button, Space } from 'antd';
import { PrinterOutlined, CloseOutlined } from '@ant-design/icons';
import type { Case, ServiceItemMaterial } from '../types';
import { getCaseMaterialList, hasCaseMaterials } from '../utils/materials';
import dayjs from 'dayjs';

interface CaseReceiptProps {
  caseData: Case;
  materials?: ServiceItemMaterial[];
  onClose?: () => void;
  showHeader?: boolean;
}

function CaseReceipt({ caseData, materials, onClose, showHeader = true }: CaseReceiptProps) {
  const materialList = materials || (hasCaseMaterials(caseData) ? getCaseMaterialList(caseData) : []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-wrapper">
      <style>{`
        @media print {
          .receipt-wrapper {
            padding: 0 !important;
          }
          .receipt-header-actions,
          .receipt-close-btn {
            display: none !important;
          }
          .receipt-container {
            box-shadow: none !important;
            border: none !important;
          }
          body {
            background: white !important;
          }
          .ant-modal-body {
            padding: 0 !important;
          }
          .ant-modal {
            top: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding-bottom: 0 !important;
          }
          .ant-modal-content {
            box-shadow: none !important;
          }
          .ant-modal-header,
          .ant-modal-footer,
          .ant-modal-close {
            display: none !important;
          }
        }
      `}</style>

      {showHeader && (
        <div className="receipt-header-actions" style={{ marginBottom: 16, textAlign: 'right' }}>
          <Space>
            {onClose && (
              <Button icon={<CloseOutlined />} onClick={onClose}>
                关闭
              </Button>
            )}
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              打印回执
            </Button>
          </Space>
        </div>
      )}

      <div
        className="receipt-container"
        style={{
          maxWidth: 800,
          margin: '0 auto',
          background: 'white',
          padding: 40,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e8e8e8',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1677ff', paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1677ff', marginBottom: 8 }}>
            政务服务办件受理回执
          </div>
          <div style={{ fontSize: 14, color: '#666' }}>
            GOVERNMENT SERVICE ACCEPTANCE RECEIPT
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f0f7ff',
              borderRadius: 6,
              border: '1px solid #91caff',
            }}
          >
            <span style={{ fontSize: 14, color: '#666' }}>办件编号</span>
            <span style={{ fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace', color: '#1677ff' }}>
              {caseData.case_number}
            </span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <tbody>
            <tr>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  width: '25%',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                申请人
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.applicant_name || '-'}
              </td>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  width: '25%',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                联系电话
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.applicant_phone || '-'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                服务事项
              </td>
              <td colSpan={3} style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.service_item_name || '-'}
                {caseData.service_item_code && (
                  <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                    ({caseData.service_item_code})
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                受理窗口
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.window_name || '-'}
              </td>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                办理科室
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.department_name || '-'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                提交时间
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8' }}>
                {caseData.created_at ? dayjs(caseData.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </td>
              <td
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e8e8e8',
                  backgroundColor: '#fafafa',
                  fontWeight: 500,
                  color: '#666',
                }}
              >
                承诺办结时间
              </td>
              <td style={{ padding: '12px 16px', border: '1px solid #e8e8e8', color: '#fa8c16', fontWeight: 500 }}>
                {caseData.deadline ? dayjs(caseData.deadline).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 12,
              paddingLeft: 8,
              borderLeft: '3px solid #1677ff',
            }}
          >
            材料摘要
          </div>
          {materialList.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e8e8e8',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#666',
                      width: 60,
                    }}
                  >
                    序号
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e8e8e8',
                      textAlign: 'left',
                      fontWeight: 500,
                      color: '#666',
                    }}
                  >
                    材料名称
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #e8e8e8',
                      textAlign: 'center',
                      fontWeight: 500,
                      color: '#666',
                      width: 80,
                    }}
                  >
                    要求
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialList.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ padding: '10px 12px', border: '1px solid #e8e8e8', textAlign: 'center' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e8e8e8' }}>
                      {item.name}
                      {item.description && (
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{item.description}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', border: '1px solid #e8e8e8', textAlign: 'center' }}>
                      {item.is_required ? (
                        <span style={{ color: '#ff4d4f', fontWeight: 500 }}>必填</span>
                      ) : (
                        <span style={{ color: '#999' }}>选填</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #e8e8e8' }}>
              暂无材料信息
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: '1px dashed #e8e8e8',
            fontSize: 12,
            color: '#999',
            lineHeight: 1.8,
          }}
        >
          <p>温馨提示：</p>
          <p>1. 请妥善保管此回执，凭办件编号可查询办理进度。</p>
          <p>2. 请在承诺办结时间内关注办件状态，如有疑问请拨打咨询电话。</p>
          <p>3. 如需补充材料，我们将通过短信或电话通知您。</p>
        </div>

        <div
          style={{
            marginTop: 24,
            textAlign: 'right',
            fontSize: 12,
            color: '#999',
          }}
        >
          <p>打印时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
          <p>本回执由系统自动生成，无需盖章</p>
        </div>
      </div>
    </div>
  );
}

export default CaseReceipt;
