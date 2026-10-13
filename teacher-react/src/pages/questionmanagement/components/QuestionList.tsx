import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Tag, Typography, Button, Checkbox, Space, Badge, Spin, Empty, Input, Pagination, List, Tooltip, Select, message, Modal } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined, DeleteOutlined, SearchOutlined, BarChartOutlined, StarOutlined, CommentOutlined, FileTextOutlined, TrophyOutlined, SortAscendingOutlined, SortDescendingOutlined, ArrowUpOutlined, ArrowDownOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { MathJaxContext, MathJax } from 'better-react-mathjax';
import { QuestionItem } from '../types';
import { mathJaxConfig } from '../config';
import axios from 'axios';

const { Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

export interface QuestionListProps {
  loading: boolean;
  filteredQuestions: QuestionItem[];
  selectedQuestionIds: number[];
  recentlySelectedIds: number[];
  recentlyCanceledIds: number[];
  isAllSelected: boolean;
  handleQuestionSelect: (questionId: number, checked: boolean) => void;
  handleSelectAllQuestions: (checked: boolean) => void;
  handleSelectDetailQuestion: (question: QuestionItem) => void;
  submitBatchSelect: (questionIds: number[]) => Promise<boolean>;
  handleDeselectQuestion: (question: any) => void;
  handleBatchDeselect: () => void;
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  currentPage: number;
  totalQuestions: number;
  pageSize: number;
  handlePageChange: (page: number) => void;
  selectionStatus: string;
  questions: QuestionItem[];
  debugMode: boolean;
  canModifyQuestions: boolean;
  sortBy: string;
  handleSortChange: (value: string) => void;
  sortOrder?: 'ascend' | 'descend';
  handleSortOrderChange?: () => void;
  isSortAllData?: boolean;
  handleSortAllDataChange?: (checked: boolean) => void;
  allScoresData?: QuestionItem[];
  resetSorting?: () => void;
}

const QuestionList: React.FC<QuestionListProps> = ({
  loading,
  filteredQuestions,
  selectedQuestionIds,
  recentlySelectedIds,
  recentlyCanceledIds,
  isAllSelected,
  handleQuestionSelect,
  handleSelectAllQuestions,
  handleSelectDetailQuestion,
  submitBatchSelect,
  handleDeselectQuestion,
  handleBatchDeselect,
  searchKeyword,
  setSearchKeyword,
  currentPage,
  totalQuestions,
  pageSize,
  handlePageChange,
  selectionStatus,
  questions,
  debugMode,
  canModifyQuestions,
  sortBy,
  handleSortChange,
  sortOrder = 'descend',
  handleSortOrderChange = () => {},
  isSortAllData = false,
  handleSortAllDataChange = () => {},
  allScoresData = [],
  resetSorting = () => {}
}) => {
  const renderImageQuestion = (question: QuestionItem) => {
    if (!question.images || question.images.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin spinning={loading} size="small" />
          <p>加载题目图片中...</p>
          {question.path && (
            <Button 
              type="link" 
              size="small"
              onClick={() => loadImageContent(question)}
            >
              点击重试加载
            </Button>
          )}
        </div>
      );
    }
    
    return (
      <div>
        {question.images.map((image, index) => (
          <img 
            key={index}
            src={`http://localhost:3001${image.url}`}
            alt={`题目图片${index + 1}`}
            style={{ 
              maxWidth: '100%', 
              marginBottom: '10px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px'
            }}
          />
        ))}
      </div>
    );
  };
  
  const loadImageContent = async (question: QuestionItem) => {
    if (!question.path) return;
    
    try {
      const response = await axios.get('http://localhost:3001/images', {
        params: { folderPath: question.path }
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const updatedQuestion = {
          ...question,
          images: response.data
        };
        
        handleSelectDetailQuestion(updatedQuestion);
      }
    } catch (error) {
      console.error(`手动加载图片失败: ${question.id}`, error);
      message.error('加载图片失败，请稍后重试');
    }
  };
  
  const renderLatexQuestion = (question: QuestionItem) => {
    if (!question.latex_code) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin spinning={loading} size="small" />
          <p>加载LaTeX内容中...</p>
          <Button 
            type="link" 
            size="small"
            onClick={() => loadLatexContent(question)}
          >
            点击重试加载
          </Button>
        </div>
      );
    }
    
    try {
      return (
        <div className="latex-container" style={{ padding: '10px' }}>
          <MathJaxContext config={mathJaxConfig}>
            <MathJax 
              key={`latex-${question.id}`}
              hideUntilTypeset={'first'} 
              inline={false} 
              dynamic={true}
              onError={(error) => console.error('MathJax渲染错误:', error)}
            >
              {question.latex_code || '暂无LaTeX代码'}
            </MathJax>
          </MathJaxContext>
        </div>
      );
    } catch (error) {
      console.error('渲染LaTeX失败:', error);
      return <div>LaTeX渲染失败，请检查代码格式</div>;
    }
  };
  
  const loadLatexContent = async (question: QuestionItem) => {
    try {
      const response = await axios.get(`http://localhost:3001/latex-questions/${question.id}`);
      
      if (response.data && response.data.latex_code) {
        const updatedQuestion = {
          ...question,
          latex_code: response.data.latex_code
        };
        
        handleSelectDetailQuestion(updatedQuestion);
      }
    } catch (error) {
      console.error(`手动加载LaTeX失败: ${question.id}`, error);
      message.error('加载LaTeX内容失败，请稍后重试');
    }
  };
  
  const renderQuestionList = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p>加载题目中...</p>
        </div>
      );
    }
    
    if (filteredQuestions.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty 
            description={searchKeyword ? "没有找到匹配的题目" : "没有找到符合条件的题目"}
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
          {searchKeyword && (
            <Button 
              type="primary" 
              onClick={() => setSearchKeyword('')}
              style={{ marginTop: '16px' }}
            >
              清除搜索
            </Button>
          )}
        </div>
      );
    }
    
    return (
      <Row gutter={[16, 16]}>
        {filteredQuestions.map(question => {
          const isTemporarySelected = selectedQuestionIds.includes(question.id);
          
          const isOfficiallySelected = question.is_selected === true;
          
          const displayTemporarySelected = isTemporarySelected && !isOfficiallySelected;
          
          const isRecentlySelected = recentlySelectedIds.includes(question.id);
          const isRecentlyCanceled = recentlyCanceledIds.includes(question.id);
          
          if (debugMode) {
            console.log(`题目ID: ${question.id}, 类型: ${question.type}, 正式选入: ${isOfficiallySelected}, 临时选择: ${isTemporarySelected}, 显示临时选择: ${displayTemporarySelected}, 原始is_selected值: ${JSON.stringify(question.is_selected)}`);
          }
          
          let statusColor = isOfficiallySelected ? "blue" : (displayTemporarySelected ? "green" : "");
          let statusText = isOfficiallySelected ? "已选入" : (displayTemporarySelected ? "已选择" : "");
          
          if (debugMode) {
            console.log(`题目渲染: ID=${question.id}, 最终状态=${statusText}, 颜色=${statusColor}`);
          }
          
          const borderStyle = isRecentlySelected ? '2px solid #52c41a' :
                            isRecentlyCanceled ? '2px solid #ff4d4f' :
                            isOfficiallySelected ? '1px solid #1890ff' : 
                            displayTemporarySelected ? '1px solid #52c41a' : 
                            '1px solid #f0f0f0';
          
          const shadowStyle = isRecentlySelected ? '0 0 15px rgba(82, 196, 26, 0.8)' : 
                            isRecentlyCanceled ? '0 0 15px rgba(255, 77, 79, 0.8)' :
                            isOfficiallySelected ? '0 0 8px rgba(24, 144, 255, 0.5)' : 
                            displayTemporarySelected ? '0 0 8px rgba(82, 196, 26, 0.5)' : 
                            '0 1px 2px rgba(0,0,0,0.1)';
          
          return (
            <Col span={12} key={question.id}>
              <Badge.Ribbon 
                text={statusText} 
                color={statusColor}
                style={{ display: statusText ? 'block' : 'none' }}
              >
                <Card
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Text strong>
                          {question.folder_name 
                            ? question.folder_name 
                            : (question.question_type && question.id 
                                ? `${question.question_type}-${question.id}`
                                : `题目 ${question.id}`)}
                        </Text>
                        <Tag color={question.type === 'latex' ? 'blue' : 'green'}>
                          {question.type === 'latex' ? 'LaTeX' : '图片'}
                        </Tag>
                      </Space>
                    </div>
                  }
                  extra={
                    <Space>
                      <Tag color="orange">{question.subject}</Tag>
                      <Tag color="purple">{question.grade}</Tag>
                      <Tag>{question.year}</Tag>
                    </Space>
                  }
                  style={{ 
                    marginBottom: '16px', 
                    height: '100%',
                    boxShadow: shadowStyle,
                    border: borderStyle,
                    transition: 'all 0.3s ease'
                  }}
                  hoverable
                  actions={[
                    <Button 
                      type="text" 
                      icon={<InfoCircleOutlined />} 
                      onClick={() => handleSelectDetailQuestion(question)}
                    >
                      查看详情
                    </Button>,
                    isOfficiallySelected ? (
                      <Button 
                        danger
                        type="primary" 
                        size="small" 
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeselectQuestion(question)}
                        disabled={!canModifyQuestions}
                      >
                        取消选入
                      </Button>
                    ) : (
                      <Space>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<CheckCircleOutlined />}
                          onClick={() => {
                            console.log(`选入题目: ID=${question.id}, 类型=${question.type || question.question_type}`);
                            const success = submitBatchSelect([question.id]);
                            success.then(result => {
                              if (result) {
                                console.log(`题目 ${question.id} 选入成功，更新UI状态`);
                              }
                            });
                          }}
                          disabled={!canModifyQuestions}
                        >
                          选入
                        </Button>
                        <Checkbox
                          checked={isTemporarySelected}
                          onChange={(e) => handleQuestionSelect(question.id, e.target.checked)}
                          style={{ 
                            transform: 'scale(1.2)',
                            '--ant-primary-color': '#52c41a'
                          } as React.CSSProperties}
                          disabled={isOfficiallySelected}
                        >
                          {isTemporarySelected ? '已临时选择' : '临时选择'}
                        </Checkbox>
                      </Space>
                    )
                  ]}
                >
                  <div style={{ height: '220px', overflow: 'auto' }}>
                    {question.type === 'image' 
                      ? renderImageQuestion(question) 
                      : renderLatexQuestion(question)}
                  </div>
                </Card>
              </Badge.Ribbon>
            </Col>
          );
        })}
      </Row>
    );
  };

  // 处理全部数据排序模式切换，添加确认对话框
  const handleSortAllDataModeChange = (checked: boolean) => {
    // 如果是关闭全部数据排序模式，直接执行
    if (!checked) {
      handleSortAllDataChange(false);
      return;
    }
    
    // 如果是开启全部数据排序模式，显示确认对话框
    confirm({
      title: '切换到全部数据排序模式',
      icon: <ExclamationCircleOutlined />,
      content: '全部数据排序会显示评分较高的题目，可能导致当前页面的内容发生变化。确定要切换吗？',
      onOk() {
        handleSortAllDataChange(true);
      },
      onCancel() {
        // 不执行操作，保持当前状态
      },
    });
  };

  return (
    <div className="question-list">
      <div className="list-toolbar">
        <div className="toolbar-left">
          <Checkbox 
            checked={isAllSelected}
            onChange={(e) => handleSelectAllQuestions(e.target.checked)}
            disabled={loading}
          >
            全选
          </Checkbox>
          
          {(selectionStatus === 'selected' || selectionStatus === 'all') && 
            filteredQuestions.filter(q => q.is_selected).length > 0 && (
            <Button 
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={loading}
              onClick={handleBatchDeselect}
              disabled={!canModifyQuestions}
            >
              批量取消选入
            </Button>
          )}
        </div>
        
        <div className="toolbar-right">
          <Input.Search
            placeholder="搜索题目..."
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 250, marginRight: 16 }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: 8 }}>排序:</span>
            <Select 
              value={sortBy} 
              onChange={handleSortChange}
              style={{ width: 140, marginRight: 8 }}
            >
              <Select.Option value="default">默认排序</Select.Option>
              <Select.Option value="total_score">总评分</Select.Option>
              <Select.Option value="ai_score">AI评分</Select.Option>
              <Select.Option value="starCount">教师评星</Select.Option>
              <Select.Option value="averageRating">学生评分</Select.Option>
            </Select>
            
            {sortBy !== 'default' && (
              <Button 
                type={sortOrder === 'ascend' ? 'primary' : 'default'}
                icon={sortOrder === 'ascend' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                onClick={handleSortOrderChange}
                style={{ marginRight: 8 }}
              >
                {sortOrder === 'ascend' ? '升序' : '降序'}
              </Button>
            )}
            
            {sortBy !== 'default' && allScoresData && allScoresData.length > 0 && (
              <Checkbox 
                checked={isSortAllData} 
                onChange={(e) => handleSortAllDataModeChange(e.target.checked)}
                style={{ fontWeight: isSortAllData ? 'bold' : 'normal', marginRight: 8 }}
              >
                <span style={{ color: isSortAllData ? '#1890ff' : 'inherit' }}>
                  全部数据排序 {allScoresData.length > 0 && `(${allScoresData.length}题)`}
                </span>
              </Checkbox>
            )}
            
            {sortBy !== 'default' && (
              <Button 
                danger
                size="small"
                onClick={resetSorting}
              >
                重置排序
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space wrap>
          <Tag color="cyan">总计: {totalQuestions} 题</Tag>
          <Tag color="green">待选入: {selectedQuestionIds.filter(id => 
            !questions.find(q => q.id === id)?.is_selected
          ).length} 题</Tag>
          <Tag color="blue">已选入: {questions.filter(q => q.is_selected).length} 题</Tag>
          {searchKeyword && (
            <Tag color="purple">搜索结果: {filteredQuestions.length} 题</Tag>
          )}
          {isSortAllData && (
            <Tag color="orange" icon={<ExclamationCircleOutlined />}>
              全部数据排序模式
            </Tag>
          )}
        </Space>
      </div>
      
      {renderQuestionList()}
      
      {totalQuestions > 0 && (
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <Pagination 
            current={currentPage}
            total={totalQuestions}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionList; 