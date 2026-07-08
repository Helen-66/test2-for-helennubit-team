const app = getApp();

const request = (url, method, data) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${app.globalData.token}`,
      },
      success(res) {
        if (res.data.code === 200) {
          resolve(res.data.data);
        } else if (res.data.code === 401) {
          wx.removeStorageSync('sitter_token');
          wx.navigateTo({ url: '/pages/mine/index' });
          reject(new Error('未登录'));
        } else {
          wx.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(new Error(res.data.message));
        }
      },
      fail(err) {
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
};

module.exports = {
  get: (url, data) => request(url, 'GET', data),
  post: (url, data) => request(url, 'POST', data),
};
