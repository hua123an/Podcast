const Router = require('koa-router');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const router = new Router();

// 内置的播客订阅源列表
const BUILT_IN_FEEDS = [
  'https://www.ximalaya.com/album/3558668.xml',
  'https://rss.lizhi.fm/rss/21628.xml',
  'https://data.getpodcast.xyz/data/ximalaya/246622.xml',
  'http://feed.tangsuanradio.com/gadio.xml',
  'https://www.ximalaya.com/album/5574153.xml',
  'https://bitvoice.banlan.show/feed/audio.xml',
  'https://keepcalm.banlan.show/feed/audio.xml'
];

// XML解析器配置
const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true
};

const parser = new XMLParser(xmlParserOptions);

// 解析RSS/Atom订阅源
async function parseFeed(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const xmlData = response.data;
    const jsonData = parser.parse(xmlData);

    // 处理RSS格式
    if (jsonData.rss && jsonData.rss.channel) {
      return parseRSSFeed(jsonData.rss.channel, url);
    }

    // 处理Atom格式
    if (jsonData.feed) {
      return parseAtomFeed(jsonData.feed, url);
    }

    throw new Error('Unsupported feed format');
  } catch (error) {
    console.error(`Error parsing feed ${url}:`, error.message);
    throw error;
  }
}

// 解析RSS格式
function parseRSSFeed(channel, url) {
  const info = {
    title: channel.title || '',
    description: channel.description || '',
    link: channel.link || '',
    image: getImageUrl(channel.image),
    author: channel.managingEditor || channel['itunes:author'] || '',
    language: channel.language || '',
    copyright: channel.copyright || ''
  };

  const episodes = [];
  const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

  items.forEach(item => {
    const episode = {
      title: item.title || '',
      description: item.description || item['itunes:summary'] || '',
      pubDate: item.pubDate || '',
      audioUrl: getAudioUrl(item.enclosure),
      duration: item['itunes:duration'] || '',
      image: getImageUrl(item['itunes:image']) || info.image,
      guid: item.guid ? (typeof item.guid === 'object' ? item.guid['#text'] : item.guid) : ''
    };
    episodes.push(episode);
  });

  return {
    url,
    info,
    episodes
  };
}

// 解析Atom格式
function parseAtomFeed(feed, url) {
  const info = {
    title: feed.title ? (typeof feed.title === 'object' ? feed.title['#text'] : feed.title) : '',
    description: feed.subtitle ? (typeof feed.subtitle === 'object' ? feed.subtitle['#text'] : feed.subtitle) : '',
    link: feed.link ? (Array.isArray(feed.link) ? feed.link[0]['@_href'] : feed.link['@_href']) : '',
    image: '',
    author: feed.author ? feed.author.name : '',
    language: feed['@_xml:lang'] || '',
    copyright: feed.rights || ''
  };

  const episodes = [];
  const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);

  entries.forEach(entry => {
    const episode = {
      title: entry.title ? (typeof entry.title === 'object' ? entry.title['#text'] : entry.title) : '',
      description: entry.summary ? (typeof entry.summary === 'object' ? entry.summary['#text'] : entry.summary) : '',
      pubDate: entry.published || entry.updated || '',
      audioUrl: getAtomAudioUrl(entry.link),
      duration: '',
      image: info.image,
      guid: entry.id || ''
    };
    episodes.push(episode);
  });

  return {
    url,
    info,
    episodes
  };
}

// 获取图片URL
function getImageUrl(imageObj) {
  if (!imageObj) return '';

  if (typeof imageObj === 'string') return imageObj;

  if (imageObj['@_href']) return imageObj['@_href'];
  if (imageObj.url) return imageObj.url;
  if (imageObj['#text']) return imageObj['#text'];

  return '';
}

// 获取音频URL (RSS)
function getAudioUrl(enclosure) {
  if (!enclosure) return '';

  if (Array.isArray(enclosure)) {
    const audioEnclosure = enclosure.find(enc =>
      enc['@_type'] && enc['@_type'].includes('audio')
    );
    return audioEnclosure ? audioEnclosure['@_url'] : '';
  }

  return enclosure['@_url'] || '';
}

// 获取音频URL (Atom)
function getAtomAudioUrl(links) {
  if (!links) return '';

  const linkArray = Array.isArray(links) ? links : [links];
  const audioLink = linkArray.find(link =>
    link['@_type'] && link['@_type'].includes('audio')
  );

  return audioLink ? audioLink['@_href'] : '';
}

// 推荐 - 获取最新一期的播客
router.get('/recommendations', async (ctx) => {
  try {
    // 随机选择几个播客源获取最新内容
    const sampleFeeds = BUILT_IN_FEEDS.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    const results = [];
    
    for (const feed of sampleFeeds) {
      try {
        const feedData = await parseFeed(feed.url);
        
        // 按发布时间排序单集，取最新的一期
        const sortedEpisodes = [...feedData.episodes].sort((a, b) => {
          return new Date(b.pubDate) - new Date(a.pubDate);
        });
        
        if (sortedEpisodes.length > 0) {
          results.push(sortedEpisodes[0]);
        }
      } catch (error) {
        console.error(`Failed to parse feed ${feed.url}:`, error.message);
      }
    }
    
    // 按最新发布日期排序推荐结果
    results.sort((a, b) => {
      return new Date(b.pubDate) - new Date(a.pubDate);
    });
    
    ctx.body = results;
  } catch (error) {
    console.error('Recommendation error:', error);
    ctx.status = 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to get recommendations: ' + error.message
    };
  }
});

// 批量获取内置播客源（增强分页支持）
router.get('/', async (ctx) => {
  try {
    const { url, all, page, limit } = ctx.query;

    // 批量获取内置播客源
    if (all === '1') {
      const pageNum = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 5;
      
      // 分页处理
      const start = (pageNum - 1) * pageSize;
      const end = start + pageSize;
      
      const paginatedFeeds = BUILT_IN_FEEDS.slice(start, end);
      
      const results = [];

      for (const feed of paginatedFeeds) {
        try {
          const feedData = await parseFeed(feed.url);
          results.push(feedData);
        } catch (error) {
          console.error(`Failed to parse feed ${feed.url}:`, error.message);
          // 继续处理其他订阅源，不因单个失败而中断
          results.push({
            url: feed.url,
            error: error.message,
            info: null,
            episodes: []
          });
        }
      }

      ctx.body = {
        currentPage: pageNum,
        pageSize: pageSize,
        total: BUILT_IN_FEEDS.length,
        totalPages: Math.ceil(BUILT_IN_FEEDS.length / pageSize),
        data: results
      };
      return;
    }

    // 获取单个播客订阅源
    if (!url) {
      ctx.status = 400;
      ctx.body = {
        error: 'Bad Request',
        message: 'Missing required parameter: url or all=1'
      };
      return;
    }

    const feedData = await parseFeed(url);
    ctx.body = feedData;

  } catch (error) {
    console.error('Feed parsing error:', error);
    ctx.status = 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to parse feed: ' + error.message
    };
  }
});

// 获取单个播客订阅源（带订阅检查）
router.get('/', async (ctx) => {
  try {
    const { url, all } = ctx.query;

    // 批量获取内置播客源
    if (all === '1') {
      const pageNum = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 5;
      
      // 分页处理
      const start = (pageNum - 1) * pageSize;
      const end = start + pageSize;
      
      const paginatedFeeds = BUILT_IN_FEEDS.slice(start, end);
      
      const results = [];

      for (const feed of paginatedFeeds) {
        try {
          const feedData = await parseFeed(feed.url);
          results.push(feedData);
        } catch (error) {
          console.error(`Failed to parse feed ${feed.url}:`, error.message);
          // 继续处理其他订阅源，不因单个失败而中断
          results.push({
            url: feed.url,
            error: error.message,
            info: null,
            episodes: []
          });
        }
      }

      ctx.body = {
        currentPage: pageNum,
        pageSize: pageSize,
        total: BUILT_IN_FEEDS.length,
        totalPages: Math.ceil(BUILT_IN_FEEDS.length / pageSize),
        data: results
      };
      return;
    }
    
    // 处理单个订阅源请求
    if (!url) {
      ctx.status = 400;
      ctx.body = {
        error: 'Bad Request',
        message: 'Missing required parameter: url'
      };
      return;
    }
    
    // 检查订阅是否存在
    const subscriptionsPath = path.join(__dirname, '../data/subscriptions.json');
    let subscriptionsData = { subscriptions: [] };
    
    try {
      const data = fs.readFileSync(subscriptionsPath, 'utf8');
      subscriptionsData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading subscriptions file:', error);
      // 如果文件不存在或无法解析，使用空数组
      subscriptionsData.subscriptions = [];
    }
    
    // 检查是否已存在
    const existingSubscription = subscriptionsData.subscriptions.find(
      subscription => subscription.url === url
    );
    
    if (existingSubscription) {
      // 如果存在，直接返回现有信息
      ctx.body = {
        message: '该订阅地址已存在，直接返回缓存信息',
        subscription: existingSubscription
      };
      return;
    }
    
    // 如果不存在，解析新订阅源
    const feedData = await parseFeed(url);
    
    // 生成新订阅对象
    const newSubscription = {
      id: Date.now().toString(),
      title: feedData.info.title || '未知标题',
      url,
      image: feedData.info.image || '',
      lastUpdated: new Date().toISOString()
    };
    
    // 添加新订阅
    subscriptionsData.subscriptions.push(newSubscription);
    
    // 写回文件
    fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptionsData, null, 2), 'utf8');
    
    // 返回解析结果
    ctx.body = {
      message: '订阅源已成功添加并解析',
      subscription: newSubscription,
      episodes: feedData.episodes
    };
    
  } catch (error) {
    console.error('Feed parsing error:', error);
    ctx.status = 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to parse feed: ' + error.message
    };
  }
});

// 处理订阅源地址
router.get('/url', async (ctx) => {
  try {
    const { url } = ctx.query;

    if (!url) {
      ctx.status = 400;
      ctx.body = {
        error: 'Bad Request',
        message: 'Missing required parameter: url'
      };
      return;
    }

    const subscriptionsPath = path.join(__dirname, '../data/subscriptions.json');
    let subscriptionsData = { subscriptions: [] };
    
    try {
      const data = fs.readFileSync(subscriptionsPath, 'utf8');
      subscriptionsData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading subscriptions file:', error);
      // 如果文件不存在或无法解析，使用空数组
      subscriptionsData.subscriptions = [];
    }

    // 检查是否已存在
    const existingSubscription = subscriptionsData.subscriptions.find(
      subscription => subscription.url === url
    );

    if (existingSubscription) {
      ctx.body = {
        message: '该订阅地址已存在',
        subscription: existingSubscription
      };
      return;
    }

    // 解析新订阅源
    const feedData = await parseFeed(url);
    
    // 生成新订阅对象
    const newSubscription = {
      id: Date.now().toString(),
      title: feedData.info.title,
      url,
      image: feedData.info.image || '',
      lastUpdated: new Date().toISOString()
    };

    // 添加新订阅
    subscriptionsData.subscriptions.push(newSubscription);

    // 写回文件
    fs.writeFileSync(subscriptionsPath, JSON.stringify(subscriptionsData, null, 2), 'utf8');

    ctx.body = {
      message: '订阅源已成功添加',
      subscription: newSubscription,
      episodes: feedData.episodes
    };
    
  } catch (error) {
    console.error('Subscription error:', error);
    ctx.status = 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to process subscription: ' + error.message
    };
  }
});

// 获取订阅数据源
router.get('/subscriptions', async (ctx) => {
  try {
    const subscriptionsPath = path.join(__dirname, '../data/subscriptions.json');
    const data = fs.readFileSync(subscriptionsPath, 'utf8');
    ctx.body = JSON.parse(data);
  } catch (error) {
    console.error('Error reading subscriptions:', error);
    ctx.status = 500;
    ctx.body = {
      error: 'Internal Server Error',
      message: 'Failed to read subscriptions data'
    };
  }
});

module.exports = router;