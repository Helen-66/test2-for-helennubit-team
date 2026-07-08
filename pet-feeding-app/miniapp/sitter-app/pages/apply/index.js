const request = require('../../utils/request');

Page({
  data: {
    form: {
      realName: '',
      idCardNo: '',
      idCardFront: '',
      idCardBack: '',
      idCardHold: '',
      certImages: [],
      longitude: 0,
      latitude: 0,
      address: '',
      serviceItems: [{ name: '喂食', price: 30, unit: '次' }],
    },
    newServiceName: '',
    newServicePrice: '',
    newServiceUnit: '次',
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async uploadImage(e) {
    const field = e.currentTarget.dataset.field;
    const res = await wx.chooseMedia({ count: 1, mediaType: ['image'] });
    const filePath = res.tempFiles[0].tempFilePath;
    // 实际项目中应上传到OSS获取URL
    this.setData({ [`form.${field}`]: filePath });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'form.address': res.address + res.name,
          'form.longitude': res.longitude,
          'form.latitude': res.latitude,
        });
      },
    });
  },

  onNewServiceInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  addService() {
    const { newServiceName, newServicePrice, newServiceUnit } = this.data;
    if (!newServiceName || !newServicePrice) return wx.showToast({ title: '请填写完整', icon: 'none' });
    const serviceItems = [...this.data.form.serviceItems, { name: newServiceName, price: parseFloat(newServicePrice), unit: newServiceUnit }];
    this.setData({ 'form.serviceItems': serviceItems, newServiceName: '', newServicePrice: '' });
  },

  removeService(e) {
    const idx = e.currentTarget.dataset.idx;
    const serviceItems = this.data.form.serviceItems.filter((_, i) => i !== idx);
    this.setData({ 'form.serviceItems': serviceItems });
  },

  async submit() {
    const { form } = this.data;
    if (!form.realName) return wx.showToast({ title: '请输入真实姓名', icon: 'none' });
    if (!form.idCardNo) return wx.showToast({ title: '请输入身份证号', icon: 'none' });
    if (!form.idCardFront || !form.idCardBack || !form.idCardHold) return wx.showToast({ title: '请上传身份证照片', icon: 'none' });
    if (!form.address) return wx.showToast({ title: '请选择服务地址', icon: 'none' });
    if (form.serviceItems.length === 0) return wx.showToast({ title: '请添加服务项目', icon: 'none' });

    try {
      await request.post('/sitter/apply', form);
      wx.showToast({ title: '提交成功，等待审核', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      console.error(e);
    }
  },
});
