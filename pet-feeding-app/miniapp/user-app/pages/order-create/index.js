const request = require('../../utils/request');

Page({
  data: {
    sitterId: null,
    sitter: null,
    pets: [],
    selectedPets: [],
    selectedServices: [],
    serviceDateStart: '',
    serviceDateEnd: '',
    dailyTimes: 1,
    address: '',
    addressLng: 0,
    addressLat: 0,
    remark: '',
    totalAmount: 0,
  },

  onLoad(options) {
    this.setData({ sitterId: parseInt(options.sitterId) });
    this.loadData();
  },

  async loadData() {
    const [sitter, pets] = await Promise.all([
      request.get(`/sitter/detail?id=${this.data.sitterId}`),
      request.get('/pet/list'),
    ]);
    this.setData({ sitter, pets });
  },

  onPetSelect(e) {
    const id = e.currentTarget.dataset.id;
    let { selectedPets } = this.data;
    const idx = selectedPets.indexOf(id);
    if (idx > -1) selectedPets.splice(idx, 1);
    else selectedPets.push(id);
    this.setData({ selectedPets });
  },

  onServiceSelect(e) {
    const name = e.currentTarget.dataset.name;
    let { selectedServices } = this.data;
    const idx = selectedServices.indexOf(name);
    if (idx > -1) selectedServices.splice(idx, 1);
    else selectedServices.push(name);
    this.setData({ selectedServices });
    this.calcAmount();
  },

  onStartDateChange(e) {
    this.setData({ serviceDateStart: e.detail.value });
    this.calcAmount();
  },

  onEndDateChange(e) {
    this.setData({ serviceDateEnd: e.detail.value });
    this.calcAmount();
  },

  onDailyTimesChange(e) {
    this.setData({ dailyTimes: parseInt(e.detail.value) || 1 });
    this.calcAmount();
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  chooseAddress() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          address: res.address + res.name,
          addressLng: res.longitude,
          addressLat: res.latitude,
        });
      },
    });
  },

  calcAmount() {
    const { sitter, selectedServices, serviceDateStart, serviceDateEnd, dailyTimes } = this.data;
    if (!sitter || !serviceDateStart || !serviceDateEnd) return;

    const days = Math.ceil((new Date(serviceDateEnd) - new Date(serviceDateStart)) / (86400000)) + 1;
    let perTime = 0;
    (sitter.serviceItems || []).forEach((item) => {
      if (selectedServices.includes(item.name)) perTime += item.price;
    });
    const totalAmount = (perTime * days * dailyTimes).toFixed(2);
    this.setData({ totalAmount });
  },

  async submitOrder() {
    const { sitterId, selectedPets, selectedServices, serviceDateStart, serviceDateEnd, dailyTimes, address, addressLng, addressLat, remark } = this.data;

    if (!selectedPets.length) return wx.showToast({ title: '请选择宠物', icon: 'none' });
    if (!selectedServices.length) return wx.showToast({ title: '请选择服务', icon: 'none' });
    if (!serviceDateStart || !serviceDateEnd) return wx.showToast({ title: '请选择日期', icon: 'none' });
    if (!address) return wx.showToast({ title: '请选择服务地址', icon: 'none' });

    try {
      const order = await request.post('/order/create', {
        sitterId,
        petIds: selectedPets,
        serviceDateStart,
        serviceDateEnd,
        dailyTimes,
        serviceItems: selectedServices,
        serviceAddress: address,
        addressLng,
        addressLat,
        remark,
      });

      // 拉起支付
      const payParams = await request.post('/payment/prepay', { orderId: order.id });
      wx.requestPayment({
        ...payParams,
        success: () => {
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(() => wx.redirectTo({ url: '/pages/order-list/index' }), 1500);
        },
        fail: () => {
          wx.showToast({ title: '支付取消', icon: 'none' });
          wx.redirectTo({ url: '/pages/order-list/index' });
        },
      });
    } catch (e) {
      console.error(e);
    }
  },
});
