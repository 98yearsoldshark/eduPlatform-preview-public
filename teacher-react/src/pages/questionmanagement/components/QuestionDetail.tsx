import React, { useState } from 'react';
import { Card, Row, Col, Button, Divider, Typography, Spin, Space, Statistic, Empty, List, Tooltip, Modal, Progress } from 'antd';
import { SyncOutlined, StarOutlined, CommentOutlined, LikeOutlined, ThunderboltOutlined, DollarOutlined, StarFilled, HeartOutlined, UnorderedListOutlined, BarChartOutlined, TrophyOutlined } from '@ant-design/icons';
import { MathJaxContext, MathJax } from 'better-react-mathjax';
import { QuestionItem, QuestionStats } from '../types';
import { mathJaxConfig } from '../config';

const { Title, Text } = Typography;

interface QuestionDetailProps {
  selectedDetailQuestion: QuestionItem | null;
  questionStats: QuestionStats | null;
  statsLoading: boolean;
  refreshQuestionStats: () => void;
}

// 定义评论数据结构
interface CommentData {
  id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  parent_id: number | null;
  replies?: CommentData[];
}

// 定义处理后的评论数据结构
interface ProcessedComment {
  id: number;
  userId: number;
  authorName: string;
  content: string;
  createdAt: string;
  formattedCreatedAt: string;
  parentId: number | null;
  replies: ProcessedComment[];
}

// 定义帖子评论集合
interface PostComments {
  postId: number;
  postTitle: string;
  comments: ProcessedComment[];
  error?: string;
}

// 定义评分结果类型
interface ScoreResult {
  totalScore: number;
  statisticsScore: number;
  aiScore: number;
  breakdown: {
    statistics: {
      starScore: number;
      ratingScore: number;
      postScore: number;
      engagementScore: number;
    };
    ai: {
      score: number;
      reason: string;
      maxScore: number;
    };
  };
  timestamp: string;
}

// 处理评论数据，确保数据结构完整
const processComments = (comments: CommentData[] = []): ProcessedComment[] => {
  return comments.map(comment => {
    return {
      id: comment.id,
      userId: comment.user_id,
      authorName: comment.author_name,
      content: comment.content,
      createdAt: comment.created_at,
      formattedCreatedAt: new Date(comment.created_at).toLocaleString(),
      parentId: comment.parent_id || null,
      // 递归处理回复
      replies: Array.isArray(comment.replies) ? processComments(comment.replies) : []
    };
  });
};

// 获取所有相关帖子的评论
const fetchAllComments = async (relatedPosts: any[] = []): Promise<PostComments[]> => {
  try {
    if (!relatedPosts || relatedPosts.length === 0) {
      return [];
    }

    // 获取所有帖子的评论
    const commentPromises = relatedPosts.map(async post => {
      try {
        const response = await fetch(`http://localhost:3003/api/community/posts/${post.id}`);
        if (!response.ok) {
          throw new Error(`获取帖子${post.id}评论失败: ${response.statusText}`);
        }
        const postData = await response.json();
        
        // 包含帖子ID和标题信息，便于确定评论所属帖子
        return {
          postId: post.id,
          postTitle: post.title,
          comments: processComments(postData.comments || [])
        };
      } catch (error: any) {
        console.error(`获取帖子${post.id}评论时出错:`, error);
        return {
          postId: post.id,
          postTitle: post.title,
          comments: [],
          error: error.message
        };
      }
    });

    return await Promise.all(commentPromises);
  } catch (error: any) {
    console.error('获取所有评论数据失败:', error);
    return [];
  }
};

// 计算基于统计数据的得分 (80分部分)
const calculateStatisticsScore = (stats: QuestionStats) => {
  // 提取统计数据
  const {
    starCount = 0,
    averageRating = 0,
    studentCount = 0,
    postCount = 0,
    commentCount = 0,
    likeCount = 0,
    recommendCount = 0,
    coinCount = 0,
    favoriteCount = 0
  } = stats;
  
  // 权重设置
  const weights = {
    starCount: 25,        // 教师打星权重25分
    averageRating: 25,    // 学生评分权重25分
    postCount: 10,        // 引用帖子数权重10分
    engagement: 20        // 互动指标总权重20分
  };
  
  // 计算教师评分部分 (满分25分)
  // 假设5星为满分，每星5分
  const starScore = Math.min(starCount * 5, weights.starCount);
  
  // 计算学生评分部分 (满分25分)
  // 假设评分为1-5分，按比例转换为0-25分
  const ratingScore = (averageRating / 5) * weights.averageRating;
  
  // 计算引用帖子分数 (满分10分)
  // 假设10个帖子为满分，按比例计算
  const postScore = Math.min(postCount / 10 * weights.postCount, weights.postCount);
  
  // 计算互动指标分数 (满分20分)
  // 互动总数
  const engagementTotal = commentCount + likeCount + recommendCount + coinCount + favoriteCount;
  // 假设50个互动为满分
  const engagementScore = Math.min(engagementTotal / 50 * weights.engagement, weights.engagement);
  
  // 计算总分 (满分80分)
  const totalScore = starScore + ratingScore + postScore + engagementScore;
  
  // 返回详细结果
  return {
    totalScore: parseFloat(totalScore.toFixed(2)),
    breakdown: {
      starScore: parseFloat(starScore.toFixed(2)),
      ratingScore: parseFloat(ratingScore.toFixed(2)),
      postScore: parseFloat(postScore.toFixed(2)),
      engagementScore: parseFloat(engagementScore.toFixed(2))
    }
  };
};

// 格式化帖子和评论数据为AI易理解的文本
const formatPostsAndCommentsForAI = (relatedPosts: any[] = [], comments: any[] = []) => {
  let formattedText = "## 题目相关帖子和评论\n\n";
  
  // 遍历所有相关帖子
  relatedPosts.forEach((post: any, index: number) => {
    formattedText += `### 帖子 ${index + 1}: ${post.title}\n`;
    formattedText += `- 作者: ${post.author}\n`;
    formattedText += `- 发布时间: ${post.formattedCreatedAt}\n`;
    formattedText += `- 互动数据: 评论(${post.commentCount}), 点赞(${post.likeCount}), 收藏(${post.favoriteCount}), 投币(${post.coinCount || 0})\n\n`;
    
    // 查找该帖子的评论
    const postComments = comments.find((c: any) => c.postId === post.id);
    if (postComments && postComments.comments && postComments.comments.length > 0) {
      formattedText += "#### 评论内容:\n";
      
      // 递归函数处理评论及其回复
      const formatComment = (comment: any, depth = 0) => {
        const indent = '  '.repeat(depth);
        formattedText += `${indent}- ${comment.authorName}: ${comment.content}\n`;
        
        // 处理回复
        if (comment.replies && comment.replies.length > 0) {
          comment.replies.forEach((reply: any) => {
            formatComment(reply, depth + 1);
          });
        }
      };
      
      // 处理所有顶级评论
      postComments.comments.forEach((comment: any) => {
        formatComment(comment);
      });
    } else {
      formattedText += "#### 暂无评论\n";
    }
    
    formattedText += "\n---\n\n";
  });
  
  return formattedText;
};

// 获取AI评分 (20分部分)
const getAIScore = async (questionInfo: QuestionItem, formattedText: string) => {
  // AI评分提示词
  const prompt = `
  请作为教育专家，评估以下数学/物理题目的质量，并给出1-20分的评分(20分为满分)。
  
  ## 题目信息
  - 学科: ${questionInfo.subject}
  - 年级: ${questionInfo.grade}
  - 年份: ${questionInfo.year}
  - 题型: ${questionInfo.question_type}
  
  ## 评估依据
  请根据以下帖子和评论内容，评估该题目的:
  1. 教学价值 (题目能否有效检验学生对知识点的掌握)
  2. 难度适中性 (题目难度是否适合目标学生群体)
  3. 思维启发性 (题目是否能启发学生思考)
  4. 实际应用性 (题目是否与实际应用相关)
  5. 整体质量 (综合以上因素及其他评论反馈)
  
  ## 帖子和评论内容
  ${formattedText}
  
  ## 输出要求
  1. 请给出1-20分的评分
  2. 简要说明评分理由(100字以内)
  3. 格式: {"score": 分数, "reason": "评分理由"}
  `;
  
  try {
    console.log('发送AI评分请求...');
    // 这里调用AI API，实际实现需要根据您使用的AI服务进行调整
    const response = await fetch('http://localhost:3003/api/ai/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
      throw new Error(`AI评分请求失败: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('AI评分结果:', result);
    
    return {
      score: result.score || 10, // 默认10分
      reason: result.reason || '无评分理由'
    };
  } catch (error) {
    console.error('AI评分出错:', error);
    return {
      score: 10, // 出错时默认给10分
      reason: `AI评分过程出错: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// 保存评分结果到数据库
const saveScoreToDatabase = async (questionId: number, questionType: string, scoreData: any) => {
  try {
    console.log('保存评分数据到数据库...');
    const response = await fetch('http://localhost:3003/api/ai/save-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId,
        questionType,
        statisticsScore: scoreData.statisticsScore,
        aiScore: scoreData.aiScore,
        totalScore: scoreData.totalScore,
        aiEvaluation: scoreData.breakdown.ai.reason
      })
    });
    
    if (!response.ok) {
      throw new Error(`保存评分数据失败: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('评分数据保存结果:', result);
    return result;
  } catch (error) {
    console.error('保存评分数据出错:', error instanceof Error ? error.message : String(error));
    return { success: false, error: '保存评分数据失败' };
  }
};

const QuestionDetail: React.FC<QuestionDetailProps> = ({
  selectedDetailQuestion,
  questionStats,
  statsLoading,
  refreshQuestionStats
}) => {
  // 添加状态管理评分模态框
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [calculatingScore, setCalculatingScore] = useState(false);

  // 计算题目总分
  const calculateTotalScore = async () => {
    if (!selectedDetailQuestion || !questionStats) {
      console.error('题目数据或统计数据不完整，无法计算分数');
      return;
    }
    
    setCalculatingScore(true);
    
    try {
      // 计算基于统计数据的80分部分
      const statisticsScoreResult = calculateStatisticsScore(questionStats);
      
      // 获取评论数据
      let commentsData: any[] = [];
      try {
        // 尝试获取评论数据，这里使用window对象上可能存在的statsData
        const windowStatsData = (window as any).statsData;
        if (windowStatsData && windowStatsData.comments) {
          commentsData = windowStatsData.comments;
        } else {
          // 如果没有找到statsData，则尝试获取评论
          commentsData = await fetchAllComments(questionStats.relatedPosts || []);
        }
      } catch (error) {
        console.error('获取评论数据失败:', error instanceof Error ? error.message : String(error));
      }
      
      // 准备AI评分所需的文本
      const formattedText = formatPostsAndCommentsForAI(
        questionStats.relatedPosts || [], 
        commentsData
      );
      
      // 获取AI评分(20分部分)
      const aiScoreResult = await getAIScore(selectedDetailQuestion, formattedText);
      
      // 计算总分(满分100分)
      const totalScore = statisticsScoreResult.totalScore + aiScoreResult.score;
      
      // 组装评分结果
      const scoreResult = {
        totalScore: parseFloat(totalScore.toFixed(2)),
        statisticsScore: statisticsScoreResult.totalScore,
        aiScore: aiScoreResult.score,
        breakdown: {
          statistics: statisticsScoreResult.breakdown,
          ai: {
            score: aiScoreResult.score,
            reason: aiScoreResult.reason,
            maxScore: 20
          }
        },
        timestamp: new Date().toISOString()
      };
      
      // 设置评分结果
      setScoreResult(scoreResult);
      
      // 显示评分模态框
      setScoreModalVisible(true);
      
      // 保存评分数据到数据库
      if (selectedDetailQuestion.id) {
        await saveScoreToDatabase(
          selectedDetailQuestion.id,
          selectedDetailQuestion.type,
          scoreResult
        );
      }
    } catch (error) {
      console.error('计算题目分数时出错:', error instanceof Error ? error.message : String(error));
      // 显示错误提示
    } finally {
      setCalculatingScore(false);
    }
  };

  if (!selectedDetailQuestion) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Empty description="请选择一个题目查看详情" />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={4}>题目详情</Title>
        <Space>
          <Button 
            icon={<TrophyOutlined />}
            onClick={calculateTotalScore}
            loading={calculatingScore}
            disabled={!questionStats || statsLoading}
          >
            计算题目得分
          </Button>
          <Button 
            icon={<BarChartOutlined />} 
            onClick={async () => {
              if (selectedDetailQuestion && questionStats) {
                // 获取评论数据
                const commentsData = await fetchAllComments(questionStats.relatedPosts);

                // 创建一个完整的JSON对象，包含所有统计信息
                const statsData = {
                  timestamp: new Date().toISOString(),
                  questionInfo: {
                    id: selectedDetailQuestion.id,
                    type: selectedDetailQuestion.type,
                    folderName: selectedDetailQuestion.folder_name || null,
                    subject: selectedDetailQuestion.subject,
                    grade: selectedDetailQuestion.grade,
                    year: selectedDetailQuestion.year,
                    questionType: selectedDetailQuestion.question_type,
                    // 添加题目内容数据
                    content: selectedDetailQuestion.type === 'latex' 
                      ? { latex_code: selectedDetailQuestion.latex_code || null }
                      : { images: selectedDetailQuestion.images || [] }
                  },
                  statistics: {
                    starCount: questionStats.starCount,
                    averageRating: typeof questionStats.averageRating === 'number' 
                      ? parseFloat(questionStats.averageRating.toFixed(2)) 
                      : (typeof questionStats.averageRating === 'string' 
                          ? parseFloat(parseFloat(questionStats.averageRating).toFixed(2)) 
                          : 0),
                    studentCount: typeof questionStats.studentCount === 'number' 
                      ? questionStats.studentCount 
                      : (typeof questionStats.studentCount === 'string' 
                          ? parseInt(questionStats.studentCount, 10) 
                          : 0),
                    postCount: questionStats.postCount,
                    commentCount: questionStats.commentCount,
                    likeCount: questionStats.likeCount,
                    recommendCount: questionStats.recommendCount,
                    coinCount: questionStats.coinCount,
                    favoriteCount: questionStats.favoriteCount,
                    appleCount: questionStats.appleCount || 0, // 总评分数
                    lastRefreshed: questionStats.lastRefreshed
                  },
                  relatedPosts: questionStats.relatedPosts 
                    ? questionStats.relatedPosts.map(post => ({
                        id: post.id,
                        title: post.title,
                        author: post.author,
                        createdAt: post.created_at,
                        formattedCreatedAt: new Date(post.created_at).toLocaleString(),
                        commentCount: post.commentCount,
                        likeCount: post.likeCount,
                        favoriteCount: post.favoriteCount,
                        coinCount: post.coinCount || 0
                      }))
                    : [],
                  // 添加评论详细数据
                  comments: commentsData
                };
                
                // 在控制台打印统计数据
                console.log('题目详细统计数据JSON：');
                console.log(statsData);
                
                // 显示友好的提示
                console.log('\n提示：可以使用 copy(statsData) 命令将数据复制到剪贴板');
                
                // 为方便开发者使用，将统计数据存储在window对象上
                (window as any).statsData = statsData;
              } else {
                console.log('题目数据或统计数据不完整，无法显示统计信息');
              }
            }}
          >
            统计分析
          </Button>
          <Button 
            icon={<SyncOutlined />} 
            onClick={refreshQuestionStats}
            loading={statsLoading}
          >
            刷新数据
          </Button>
        </Space>
      </div>
      
      <Card 
        title={
          <Space>
            <Text strong>{selectedDetailQuestion.folder_name || `题目 ${selectedDetailQuestion.id}`}</Text>
            <Tooltip title={selectedDetailQuestion.type === 'latex' ? 'LaTeX题目' : '图片题目'}>
              <Text type="secondary">{selectedDetailQuestion.type === 'latex' ? 'LaTeX' : '图片'}</Text>
            </Tooltip>
          </Space>
        }
        variant="outlined"
        style={{ marginBottom: '20px' }}
      >
        <div style={{ minHeight: '200px' }}>
          {selectedDetailQuestion.type === 'image' && selectedDetailQuestion.images && selectedDetailQuestion.images.length > 0 ? (
            // 渲染图片题目
            <Row gutter={[16, 16]}>
              {selectedDetailQuestion.images.map((image, index) => (
                <Col span={index === 0 ? 24 : 8} key={index}>
                  <img
                    src={`http://localhost:3001${image.url}`}
                    alt={image.name}
                    style={{ width: '100%', maxHeight: index === 0 ? '400px' : '200px', objectFit: 'contain' }}
                  />
                </Col>
              ))}
            </Row>
          ) : selectedDetailQuestion.type === 'latex' && selectedDetailQuestion.latex_code ? (
            // 渲染LaTeX题目，使用错误处理
            <div className="latex-question-container" style={{ padding: '15px' }}>
              <MathJaxContext config={mathJaxConfig}>
                <MathJax 
                  key={`latex-${selectedDetailQuestion.id}`}
                  hideUntilTypeset={'first'} 
                  inline={false} 
                  dynamic={true}
                  onError={(error) => console.error('MathJax渲染错误:', error)}
                >
                  {selectedDetailQuestion.latex_code || '暂无LaTeX代码'}
                </MathJax>
              </MathJaxContext>
            </div>
          ) : (
            <Empty description="未找到题目内容" />
          )}
        </div>
      </Card>
      
      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p>加载统计数据中...</p>
        </div>
      ) : questionStats ? (
        <>
          <Card title="统计数据总览" variant="outlined" style={{ marginBottom: '20px' }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic 
                  title="教师打星数" 
                  value={questionStats.starCount} 
                  prefix={<StarOutlined style={{ color: '#fadb14' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="学生平均评分" 
                  value={questionStats && typeof questionStats.averageRating === 'number' && questionStats.averageRating > 0 ? 
                    parseFloat(questionStats.averageRating.toFixed(1)) : 
                    (questionStats && typeof questionStats.averageRating === 'string' && parseFloat(questionStats.averageRating) > 0 ? 
                      parseFloat(parseFloat(questionStats.averageRating).toFixed(1)) : 
                      0)} 
                  suffix={
                    <Tooltip title="参与评分的学生人数">
                      {`(${questionStats ? 
                        (typeof questionStats.studentCount === 'number' ? 
                          questionStats.studentCount : 
                          (typeof questionStats.studentCount === 'string' ? 
                            parseInt(questionStats.studentCount, 10) : 
                            0)) : 
                        0}人)`}
                    </Tooltip>
                  }
                  prefix={<HeartOutlined style={{ color: '#f5222d' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="引用帖子数" 
                  value={questionStats.postCount} 
                  prefix={<UnorderedListOutlined style={{ color: '#1890ff' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="评论总数" 
                  value={questionStats.commentCount} 
                  prefix={<CommentOutlined style={{ color: '#52c41a' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="点赞总数" 
                  value={questionStats.likeCount} 
                  prefix={<LikeOutlined style={{ color: '#fa541c' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="推荐总数" 
                  value={questionStats.recommendCount} 
                  prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="投币总数" 
                  value={questionStats.coinCount} 
                  prefix={<DollarOutlined style={{ color: '#faad14' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="收藏总数" 
                  value={questionStats.favoriteCount} 
                  prefix={<StarFilled style={{ color: '#f5222d' }} />}
                />
              </Col>
            </Row>
            <Divider />
            <Text type="secondary">最后更新时间: {new Date(questionStats.lastRefreshed).toLocaleString()}</Text>
          </Card>
          
          <Card title="引用该题目的帖子" variant="outlined" style={{ marginBottom: '20px' }}>
            {questionStats.relatedPosts && questionStats.relatedPosts.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={questionStats.relatedPosts}
                renderItem={(post) => (
                  <List.Item
                    actions={[
                      <Tooltip title="评论数">
                        <Space>
                          <CommentOutlined /> {post.commentCount}
                        </Space>
                      </Tooltip>,
                      <Tooltip title="点赞数">
                        <Space>
                          <LikeOutlined /> {post.likeCount}
                        </Space>
                      </Tooltip>,
                      <Tooltip title="收藏数">
                        <Space>
                          <StarOutlined /> {post.favoriteCount}
                        </Space>
                      </Tooltip>
                    ]}
                  >
                    <List.Item.Meta
                      title={<a href={`/community?postId=${post.id}`} target="_blank">{post.title}</a>}
                      description={
                        <Space>
                          <Text type="secondary">作者: {post.author}</Text>
                          <Text type="secondary">发布时间: {new Date(post.created_at).toLocaleString()}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无引用该题目的帖子" />
            )}
          </Card>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty description="暂无统计数据，点击「刷新数据」获取最新统计" />
        </div>
      )}
      
      {/* 评分结果模态框 */}
      <Modal
        title="题目综合评分结果"
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setScoreModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {scoreResult && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <Progress
                type="circle"
                percent={scoreResult.totalScore}
                format={percent => `${percent}/100分`}
                width={120}
                status={
                  scoreResult.totalScore >= 80 ? 'success' :
                  scoreResult.totalScore >= 60 ? 'normal' : 'exception'
                }
              />
            </div>
            
            <Divider>分数明细</Divider>
            
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="统计数据评分 (80分)" bordered={false}>
                  <Statistic
                    title="得分"
                    value={scoreResult.statisticsScore}
                    suffix="/80"
                    precision={2}
                  />
                  <Divider />
                  <ul>
                    <li>教师打星: {scoreResult.breakdown.statistics.starScore}/25分</li>
                    <li>学生评分: {scoreResult.breakdown.statistics.ratingScore}/25分</li>
                    <li>引用帖子: {scoreResult.breakdown.statistics.postScore}/10分</li>
                    <li>互动指标: {scoreResult.breakdown.statistics.engagementScore}/20分</li>
                  </ul>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="AI内容评分 (20分)" bordered={false}>
                  <Statistic
                    title="得分"
                    value={scoreResult.aiScore}
                    suffix="/20"
                    precision={2}
                  />
                  <Divider />
                  <div>
                    <Text strong>评分理由:</Text>
                    <p>{scoreResult.breakdown.ai.reason}</p>
                  </div>
                </Card>
              </Col>
            </Row>
            
            <Divider />
            <Text type="secondary">评分时间: {new Date(scoreResult.timestamp).toLocaleString()}</Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QuestionDetail; 