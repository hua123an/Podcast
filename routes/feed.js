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

// GET /api/feed 路由
router.get('/', async (ctx) => {
  try {
    const { url, all } = ctx.query;

    // 批量获取内置播客源
    if (all === '1') {
      const results = [];

      for (const feedUrl of BUILT_IN_FEEDS) {
        try {
          const feedData = await parseFeed(feedUrl);
          results.push(feedData);
        } catch (error) {
          console.error(`Failed to parse feed ${feedUrl}:`, error.message);
          // 继续处理其他订阅源，不因单个失败而中断
          results.push({
            url: feedUrl,
            error: error.message,
            info: null,
            episodes: []
          });
        }
      }

      ctx.body = results;
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

module.exports = router;