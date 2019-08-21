'use babel';

import { CompositeDisposable } from 'atom';

export default {

  subscriptions: null,
  handleOpens: null,
  handleCloses: null,
  dontSwitch: null,
  altKey: null,
  ctrlKey: null,
  metaKey: null,
  shiftKey: null,

  config: {
    corefunctions: {
      title: '核心功能配置( Core Function setting )',
      description: '核心功能配置( Core Function setting ) ',
      type: 'object',
      properties: {
        handleOpens: {
          title: '监测文件打开操作( Observe Opens )',
          description: '如果开启的属于markdown文件则自动开启预览( Automatically open a previewer pane when opening a markdown file )',
          type: 'boolean',
          default: true,
          order: 1
        },
        handleCloses: {
          title: '监测文件关闭操作( Observe Closes )',
          description: '如果关闭 markdown 文件则自动关闭对应预览( Automatically close a previewer pane when the last editor for that md file is closed)',
          type: 'boolean',
          default: true,
          order: 1
        }
      }
    },
    behavior: {
      title: '功能屏蔽按键( Prevent behaviour )',
      description: '跳过本插件功能,如果你设置了如下按键 Bypass default behaviour (activating the preview, *and* open/close handlers), if:',
      type: 'object',
      properties: {
        withAlt: {
          title: 'Alt 使能屏蔽',
          type: 'boolean',
          default: true,
          order: 2
        },
        withCtrl: {
          title: 'Ctrl 使能屏蔽',
          type: 'boolean',
          default: false,
          order: 2
        },
        withMeta: {
          title: 'Meta (Win/Mac) 使能屏蔽',
          type: 'boolean',
          default: true,
          order: 2
        },
        withShift: {
          title: 'Shift 使能屏蔽',
          type: 'boolean',
          default: true,
          order: 2
        }
      }
    },
    debugOutput: {
      title: '弹窗信息显示(Whether to display popup information)',
      description: '插件错误信息右上角弹窗显示状态(When the error occurs, the pop-up window in the upper right corner displays the status)',
      type: 'boolean',
      default: true,
      order: 3
    }
  },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // 注册文件打开关闭钩子函数
    this.subscriptions.add(atom.workspace.onDidOpen(module.exports.openHandler));
    this.subscriptions.add(atom.workspace.onDidDestroyPaneItem(module.exports.closeHandler));

    // 自动打开预览
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(module.exports.autoPreview));

    // 按键事件监听
    atom.views.getView(atom.workspace).addEventListener('keydown', module.exports.keyTracker);
    atom.views.getView(atom.workspace).addEventListener('keyup', module.exports.keyTracker);

    // Close “Allow Pending Pane Items”
    atom.config.set('core.allowPendingPaneItems', false);
    atom.notifications.addSuccess( 'Markdown Preview Auto Open Close', {detail:'成功启动!'});
    module.exports.debugOutput && console.log('core.allowPendingPaneItems was been seting false');
  },

  deactivate() {
    atom.views.getView(atom.workspace).removeEventListener('keydown', module.exports.keyTracker);
    atom.views.getView(atom.workspace).removeEventListener('keyup', module.exports.keyTracker);
    this.subscriptions.dispose();
    this.subscriptions = null;
  },

  serialize() { },

  autoPreview(editor) {

    // Checkout “Allow Pending Pane Items”
    module.exports.checkSetting();

    if (!atom.workspace.isTextEditor(editor)) {
      module.exports.debugOutput && console.log('The activated pane item was not an editor');
      return;
    }

    module.exports.debugOutput && console.log('Activated editor: ', editor.getTitle());

    if (module.exports.bypassAction()) { return; }

    previewURI = module.exports.previewURI(editor);
    previewPane = atom.workspace.paneForURI(previewURI);
    if (!previewPane) {
      module.exports.debugOutput && console.log('There is no preview for this editor');
      return;
    }

    previewItem = previewPane.itemForURI(previewURI);
    module.exports.debugOutput && console.log('Corresponding previewer: ', previewItem.getTitle());

    if (previewPane !== atom.workspace.paneForItem(editor)) {
      module.exports.debugOutput && console.log('The previewer is in a different pane; activating');
      previewPane.activateItem(previewItem);
    } else {
      module.exports.debugOutput && console.log('The previewer is in the same pane; aborting');
    }
  },

  openHandler(event) {

    // Checkout “Allow Pending Pane Items”
    module.exports.checkSetting();

    //atom.config.set('core.allowPendingPaneItems', false);
    // module.exports.debugOutput && console.log('core.allowPendingPaneItems');
    if (!event.item || !atom.workspace.isTextEditor(event.item)) {
      module.exports.debugOutput && console.log('The opened pane item was not a text editor');
      return;
    } else {
      module.exports.debugOutput && console.log('Opened editor: ', event.item.getTitle());
    }

    if (atom.workspace.paneForURI(module.exports.previewURI(event.item))) {
      module.exports.debugOutput && console.log(`The previewer for ${event.item.getTitle()} has already been opened`);
      return;
    }

    if (!atom.config.get('atom-markdown-auto-preview.handleOpens')) {
      module.exports.debugOutput && console.log('Config is set to ignore file opens');
      return;
    }

    if (module.exports.bypassAction()) { return; }

    // 打开预览
    if ('getGrammar' in event.item &&
        event.item.getGrammar() &&
        event.item.getGrammar().name.includes('Markdown')) {
      module.exports.debugOutput && console.log('Opening the previewer with :toggle');
      atom.commands.dispatch(atom.views.getView(event.item), 'markdown-preview:toggle');
    } else {
      module.exports.debugOutput && console.log('The file is not a Markdown file; aborting');
    }
  },

  closeHandler(event) {

    // Checkout “Allow Pending Pane Items”
    module.exports.checkSetting();

    if (!event.item || !atom.workspace.isTextEditor(event.item)) {
      module.exports.debugOutput && console.log('The closed pane item was not a text editor');
      return;
    } else {
      module.exports.debugOutput && console.log('Closed editor: ', event.item.getTitle());
    }

    if (!atom.config.get('atom-markdown-auto-preview.handleCloses')) {
      module.exports.debugOutput && console.log('Config is set to ignore file closes');
      return;
    }

    if (module.exports.bypassAction()) { return; }

    // 关闭预览
    previewURI = module.exports.previewURI(event.item);
    previewPane = atom.workspace.paneForURI(previewURI);
    if (previewPane) {
      module.exports.debugOutput && console.log('Destroying previewer for ', event.item.getTitle());
      previewPane.destroyItem(previewPane.itemForURI(previewURI));
    } else {
      module.exports.debugOutput && console.log('There is no preview open for ', event.item.getTitle());
    }
  },

  previewURI(editor) {
    return `markdown-preview://editor/${editor.id}`;
  },

  keyTracker(event) {
    module.exports.debugOutput && console.log('Event: ', event);
    module.exports.debugOutput && console.log('Module.exports: ', module.exports);
    module.exports.altKey = event.altKey;
    module.exports.ctrlKey = event.ctrlKey;
    module.exports.metaKey = event.metaKey;
    module.exports.shiftKey = event.shiftKey;
  },

  bypassAction() {

    // Checkout “Allow Pending Pane Items”
    module.exports.checkSetting();

    if (atom.config.get('atom-markdown-auto-preview.behaviour.dontSwitch') === true &&
        module.exports.altKey === atom.config.get('atom-markdown-auto-preview.behaviour.withAlt') &&
        module.exports.ctrlKey === atom.config.get('atom-markdown-auto-preview.behaviour.withCtrl') &&
        module.exports.metaKey === atom.config.get('atom-markdown-auto-preview.behaviour.withMeta') &&
        module.exports.shiftKey === atom.config.get('atom-markdown-auto-preview.behaviour.withShift')) {
      module.exports.debugOutput && console.log('Bypass modifiers match config settings');
      return true;  // 附加按键跳过打开markdown预览
    } else {
      module.exports.debugOutput && console.log('No modifier bypass will occur');
      return false;  // bypass modifiers don't match
    }
  },

  checkSetting(){
    // 插件设置检测 “Allow Pending Pane Items”
    if ( atom.config.get('core.allowPendingPaneItems') == true)
    {
      atom.notifications.addError( '自动开启关闭MD预览功能出问题了', {detail:'allowPendingPaneItems被设置了,本插件无法正常使用,开始自动修复...'})
      atom.config.set('core.allowPendingPaneItems', false);
      if ( atom.config.get('core.allowPendingPaneItems') == true)
      {
        atom.notifications.addError( '修复失败', {detail:'好像有别的插件干扰了哟,靠你自己解决,或者反馈本插件作者。'})
        return;
      }else{
        atom.notifications.addSuccess( 'Markdown Preview Auto Open Close', {detail:'功能正常启用,请重新操作。'});
      }
    }
  }

};
