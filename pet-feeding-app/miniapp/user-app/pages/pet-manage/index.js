const request = require('../../utils/request');

Page({
  data: {
    pets: [],
    showForm: false,
    form: { name: '', species: '猫', breed: '', weight: '', age: '', gender: 1, characterDesc: '', feedingNotes: '' },
    editId: null,
  },

  onShow() {
    this.loadPets();
  },

  async loadPets() {
    const pets = await request.get('/pet/list');
    this.setData({ pets });
  },

  showAddForm() {
    this.setData({ showForm: true, editId: null, form: { name: '', species: '猫', breed: '', weight: '', age: '', gender: 1, characterDesc: '', feedingNotes: '' } });
  },

  editPet(e) {
    const pet = this.data.pets.find((p) => p.id === e.currentTarget.dataset.id);
    this.setData({ showForm: true, editId: pet.id, form: { ...pet } });
  },

  hideForm() {
    this.setData({ showForm: false });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onSpeciesChange(e) {
    const species = ['猫', '狗', '其他'][e.detail.value];
    this.setData({ 'form.species': species });
  },

  onGenderChange(e) {
    this.setData({ 'form.gender': parseInt(e.detail.value) + 1 });
  },

  async savePet() {
    const { form, editId } = this.data;
    if (!form.name) return wx.showToast({ title: '请输入宠物名称', icon: 'none' });

    const data = { ...form, weight: form.weight ? parseFloat(form.weight) : null };
    if (editId) {
      await request.post('/pet/update', { id: editId, ...data });
    } else {
      await request.post('/pet/create', data);
    }

    wx.showToast({ title: '保存成功' });
    this.setData({ showForm: false });
    this.loadPets();
  },

  async deletePet(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该宠物吗？',
      success: async (res) => {
        if (res.confirm) {
          await request.post('/pet/delete', { id });
          this.loadPets();
        }
      },
    });
  },
});
