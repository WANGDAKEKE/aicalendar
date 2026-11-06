const lines = {
  ready: {
    cheeky: [['你暂停的那集，','还在等你。'], ['人是走了，','进度还在这。'], ['你忙你的。','我先替你惦记。']],
    gentle: [['上次的故事，','接着看吧。'], ['有空的时候，','一起接着看。']],
    tag: '在线等，不太急', face: '¬‿¬',
  },
  evening: {
    cheeky: [['手机都打开了，','顺便看看我呗。'], ['都晚上了，','还搁这划呢。'], ['你负责忙，','我负责等是吧。']],
    gentle: [['忙完了吗？','故事还在等你。'], ['今晚有空，','接着看一会儿。']],
    tag: '开始阴阳怪气', face: '눈_눈',
  },
  waiting: {
    cheeky: [['你再不来，','我要长蘑菇了。'], ['这位观众，','您还记得我吗。'], ['我都躺平了，','你还没空看。']],
    gentle: [['有阵子没见，','要接着看吗？'], ['故事替你留着，','有空再继续。']],
    tag: '等到逐渐躺平', face: '（_ _）',
  },
  returned: {
    cheeky: [['行，来过就行。','今天不闹你。'], ['嘴上不说，','其实挺开心的。'], ['刚才我声大了。','你来就好。']],
    gentle: [['今天一起看过了，','开心。'], ['你的进度，','我替你记住了。']],
    tag: '已哄好', face: '˘◡˘',
  },
  resting: {
    cheeky: [['你追平了。','急的该是剧组了。'], ['这回真没了。','咱俩一起等。']],
    gentle: [['已经追平啦，','下次更新再见。'], ['这一段看完了，','歇一歇吧。']],
    tag: '一起等更新', face: 'ᴗ_ᴗ',
  },
  welcome: {
    cheeky: [['还不熟。','看一集就熟了。'], ['先看点什么，','我才好惦记你。']],
    gentle: [['从一个故事，','开始认识你。'], ['想看点什么？','一起找找吧。']],
    tag: '初次见面', face: '•ᴗ•',
  },
  unavailable: {
    cheeky: [['这部暂时看不了。','换个故事唠。']],
    gentle: [['故事暂时离开了，','看看别的吧。']],
    tag: '换个故事继续', face: '·_·',
  },
  'logged-out': {
    cheeky: [['先认个脸。','我才知道等谁。']],
    gentle: [['登录一下，','接着上次的故事。']],
    tag: '等你来认领', face: '•_•',
  },
};

export function companionCopy(selection, tone = 'cheeky', index = 0) {
  const key = selection.status === 'logged-out' ? 'logged-out'
    : selection.status === 'unavailable' ? 'unavailable' : selection.mood;
  const group = lines[key] || lines.welcome;
  const choices = group[tone === 'gentle' ? 'gentle' : 'cheeky'];
  const safeIndex = Number.isSafeInteger(index) && index >= 0 ? index : 0;
  return {...group, lines: choices[safeIndex % choices.length], key};
}
