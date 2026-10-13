// 题目类型接口
export interface QuestionItem {
  id: number;
  type: 'image' | 'latex';
  subject: string;
  grade: string;
  year: string;
  question_type: string;
  folder_name?: string;
  path?: string;
  latex_code?: string;
  images?: Array<{name: string, url: string}>;
  is_selected: boolean;
  // 评分相关字段
  total_score?: number;       // 总评分(100分)
  ai_score?: number;          // AI评分(20分)
  ai_evaluation?: string;     // AI评价内容
  score_updated_at?: string;  // 评分更新时间
  // 统计数据字段
  starCount?: number;         // 教师打星数
  postCount?: number;         // 引用帖子数
  commentCount?: number;      // 评论总数
  likeCount?: number;         // 点赞总数
  recommendCount?: number;    // 推荐总数
  coinCount?: number;         // 投币总数
  favoriteCount?: number;     // 收藏总数
  appleCount?: number;        // 学生总评分数
  studentCount?: number;      // 评分学生数
  averageRating?: number;     // 平均评分
}

// 题目统计数据接口
export interface QuestionStats {
  id: number;
  type: 'image' | 'latex';
  starCount: number; 
  postCount: number;
  commentCount: number;
  likeCount: number;
  recommendCount: number;
  coinCount: number;
  favoriteCount: number;
  appleCount: number; // 学生总评分数
  studentCount: number; // 评分学生数
  averageRating: number; // 平均评分
  lastRefreshed: string;
  relatedPosts: Array<{
    id: number;
    title: string;
    author: string;
    commentCount: number;
    likeCount: number;
    coinCount: number;
    favoriteCount: number;
    created_at: string;
  }>;
} 