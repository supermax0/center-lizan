/**
 * نظام المصادقة والأدوار - Firebase Auth + Firestore users
 */
(function () {
  'use strict';

  const ROLES = {
    admin: 'admin',
    doctor: 'doctor',
    reception: 'reception',
    inventory: 'inventory',
    client: 'client'
  };

  const ROLE_LABELS = {
    admin: 'مدير',
    doctor: 'طبيب',
    reception: 'استقبال',
    inventory: 'مخزون',
    client: 'عميل'
  };

  window.auth = {
    currentUser: null,
    userRole: null,
    userDoc: null,

    get roleLabel() {
      return ROLE_LABELS[this.userRole] || this.userRole;
    },

    init() {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase not loaded');
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            this.currentUser = user;
            await this.loadUserRole(user.uid);
            resolve(user);
          } else {
            this.currentUser = null;
            this.userRole = null;
            this.userDoc = null;
            resolve(null);
          }
        });
      });
    },

    async loadUserRole(uid) {
      try {
        const doc = await firebase.firestore().collection('users').doc(uid).get();
        if (doc.exists) {
          this.userDoc = doc.data();
          const role = (this.userDoc.role || 'client').toString().trim().toLowerCase();
          this.userRole = ['admin', 'doctor', 'reception', 'inventory', 'client'].includes(role) ? role : 'client';
        } else {
          this.userRole = 'client';
          this.userDoc = { displayName: '', role: 'client' };
        }
      } catch (e) {
        console.error('loadUserRole', e);
        this.userRole = 'client';
      }
    },

    async login(email, password) {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      await this.loadUserRole(cred.user.uid);
      return cred.user;
    },

    async logout() {
      await firebase.auth().signOut();
      this.currentUser = null;
      this.userRole = null;
      this.userDoc = null;
    },

    can(permission) {
      const role = (this.userRole || '').toLowerCase();
      switch (permission) {
        case 'dashboard': return ['admin', 'doctor', 'reception', 'inventory'].includes(role);
        case 'appointments': return ['admin', 'doctor', 'reception'].includes(role);
        case 'clients': return ['admin', 'reception', 'doctor'].includes(role);
        case 'inventory': return ['admin', 'inventory'].includes(role);
        case 'admin': return role === 'admin';
        default: return false;
      }
    },

    redirectIfUnauthorized() {
      if (!this.currentUser) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },

    ROLES,
    ROLE_LABELS
  };
})();
