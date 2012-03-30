// ==UserScript==
// @name           PFC Extra
// @namespace      http://lymia.x10.bz/
// @author         Lymia <lymiahugs@gmail.com>
// @description    Modifies PHPFreeChat's client to add in some additional functionality
// @license        Public Domain
// @version        1.2.2
// @run-at         document-end
// @include        *
// ==/UserScript==

/*
Current Features:
	- Custom full RGB nick color
	- Per-nick colors
	- RP text features
	- Disable Smiley sending
	- Custom filter code injection
Commands:
	/rpme [character] [text] - Does a /me as a character
	/autorp [normal|shift|alt|shiftalt] [set|off] [nick] - Sets up an automatic RP
	/enable - reenable PFC Extra if you've disabled it before
Changelog:
	v1.2.0:
		* First public release
	v1.2.1:
		* Minor compatibility improvements.
	v1.2.2:
		* PFC Extra now works on Chrome.
*/

if(window.navigator.vendor.match(/Google/)) {
	var div = document.createElement("div");
	div.setAttribute("onclick", "return window;");
	unsafeWindow = div.onclick();
}

if(!unsafeWindow.pfcClient ||
   !document.getElementById('pfc_loader') ||
   !document.getElementById('pfc_container')) return;

if(!GM_setValue||!GM_getValue||!GM_deleteValue) {
	if(!localStorage) {
		alert("PFC Extra does not support this browser.");
		return;
	}

	var serializeObject = function(obj) {
		if(typeof obj=='number') return ''+obj; //NaN, and infinity are not covered, but, who cares.
		else if(typeof obj=='string') return 'unescape("'+escape(obj)+'")';
		else if(typeof obj=='boolean') return ''+obj;
		else throw "Type can not be stored";
	};

	var GM_setValue = function(key, value) {
		localStorage.setItem(key, serializeObject(value));
	};
	var GM_getValue = function(key, def) { 
		var v = localStorage.getItem(key); 
		return v==null?def:eval(v);
	};
	var GM_deleteValue = function(key) {
		if(localStorage.getItem(key)!=null) localStorage.removeItem;
	};
}

function __pfc_extra_hook() {
	/*---------------\
	| Util Functions |
	\---------------*/

	var _G = (function(){return this}());

	var getElem = function(id) {
		return document.getElementById(id);
	}
	var addElem = function(tag_type, target, parameters, text) {
		var newElement = document.createElement(tag_type);
		if (typeof parameters != 'undefined') for (parameter_name in parameters)
			newElement.setAttribute(parameter_name, parameters[parameter_name]);
		if (typeof text != 'undefined')
			newElement.innerHTML = text;
		if (typeof target != 'undefined' && target != null) {
			if(typeof target == 'string') target = getElem(target);

			if(target) {
				target.appendChild(newElement);
			} else {
				debugprint('element '+id+' not found!');
			}
		}
		return newElement;
	};
	var removeElem = function(id) {
		var element = getElem(id);
		if(element) {
			element.parentNode.removeChild(element);
		} else {
			debugprint('element '+id+' not found!');
		}
	};

	var debug = true;
	var debugprint = function(str) {
		if(debug && console && console.debug) {
			console.debug(str);
		}
	};

	var clone = function(hash,n) {
		if(n==undefined) var n = {};
		else for(k in n) delete n[k];

		for(k in hash) n[k] = hash[k];
		return n;
	}

	var p={};
	var defined={};
	var disable = clone(pfcClient.prototype);
	disable.sendRequestReal=disable.sendRequest;
	disable.sendRequest=function(string,id) {
		if(!this.initDone) {
			getElem('pfc_container').style.display='block';
			this.initDone = true;
		}

		if(string=='/enable ') {
			p.resetChat.bind(this)(false);
			return;
		}
		return this.sendRequestReal(string,id);
	};

	/*---------------\
	| User Interface |
	\---------------*/

	var initColor = '#000000';
	var zws = '\u2060';
	var loading = getElem('pfc_loader').innerHTML;
	p.process = function(string,nick,prefix) {
		if(prefix==undefined) prefix='';

		try {
			string = this.getFunction(this.addProcess)(string,nick);
		} catch(e) {
			this.displayMsg('','Custom text processor returned error: <br/>'+e.toString());
			throw e;
		}
		if(!this.useSmilies.checked) string = this.cleanSmilies(string);
		string = prefix + string;
		if(this.useColor.checked) string = '[color='+this.getColor(nick)+'] '+string+' [/color]';
		return string;
	};
	p.processSmiley = function(smiley) {
		if(this.useSmilies.checked) return smiley;
		else return '[img]'+this.res.getSmileyHash().get(Encoder.htmlEncode(smiley))+'[/img]';
	};
	p.cleanSmilies = function(string) {
		if(this.smileyReplace == undefined) {
			var s = this.res.getSmileyKeys();
			this.smileyReplace = {};
			for(var i=0; i<s.length; i++) {
				var smiley = Encoder.htmlDecode(s[i])
				this.smileyReplace[smiley] = smiley.slice(0,1)+zws+smiley.slice(1);
			}
		}
		for(n in this.smileyReplace) {
			string = string.replace(n,this.smileyReplace[n]);
		}
		return string;
	};
	var re_rpMe = new RegExp("([^ ]+)( (.*)|)");
	var re_autoRp = new RegExp("([^ ]+) ([^ ]+)( ([^ ]+)|)");

	var autoRpReadable = {
		normal: '00',
		shift: '10',
		alt: '01',
		shiftalt: '11'
	};
	p.cmdHook = function(cmd,param,nick) {
		debugprint('Command: ');
		debugprint(cmd);
		debugprint(param);
		try {
			if(this.getFunction(this.addCommand)(cmd,param,nick)) return false;
		} catch(e) {
			this.displayMsg('','Custom command processor returned error: <br/>'+e.toString());
			return false;
		}
		if(cmd=='/me'&&nick==this.nickname) {
			var cmd = this.meNotice.checked?'/notice ':'/me ';
			var nstr = nick+' ';
			if(this.meProcess.checked) param = this.process(param,nick,this.meNotice.checked?nstr:'');

			this.sendRequest(cmd+param);
			return false;
		} else if(cmd=='/rpme'||cmd=='/r'||(cmd=='/me'&&nick!=this.nickname)) {
			if(cmd=='/me'&&nick!=this.nickname) param = nick + ' ' + param;

			if(!param.match(re_rpMe)) {
				this.displayMsg('','Usage: /rpme [nick] [text]');
			} else {
				var nick = param.replace(re_rpMe,'$1');
				var msg = param.replace(re_rpMe,'$3');

				if(this.rpmeNotice.checked) {
					this.sendRequest('/notice '+this.process(msg,nick,'['+this.nickname+'] '+nick+' '));
				} else {
					this.sendRequest('/send '+this.process(sprintf(this.rpmeFormat.value,nick,msg),nick));
				}
			}
			return false;
		} else if(cmd=='/autorp'||cmd=='/ar') {
			if(param=='') {
				var print = function(code) {
					if(this.autoRp[code]) return this.autoRp[code];
					else return '(None)';
				}.bind(this);
				this.displayMsg('','Normal: '+print('00')+'<br>'+
						   'Shift: '+print('10')+'<br>'+
						   'Alt: '+print('01')+'<br>'+
						   'Shift-Alt: '+print('11'));
			} else {
				if(!param.match(re_autoRp)) {
					this.displayMsg('','Usage: /autorp [normal|shift|alt|shiftalt] [set|off] [nick]');	
				} else {
					var type = autoRpReadable[param.replace(re_autoRp,'$1')];
					var action = param.replace(re_autoRp,'$2');
					var nick = param.replace(re_autoRp,'$4');
					if(type==undefined) {
						this.displayMsg('','Bind target must be one of: normal, shift, alt, shiftalt');
					} else {
						if(action=='set') {
							if(nick=='') this.displayMsg('','No nick found');
							else this.autoRp[type]=nick;
						} else if(action=='off') delete this.autoRp[type];
						else this.displayMsg('','Action must be one of: set, off');
					
						this.regenHandle();

						var a = ['00','01','10','11'];
						for(var i=0;i<a.length;i++) {
							var f = 'ARP'+a[i];
							if(this.autoRp[a[i]]) pfc_extra['set'+f](this.autoRp[a[i]]);
							else pfc_extra['delete'+f]();
						}
					}
				}
			}
			return false;
		}
		return true;
	};
	p.toggleBox = function(box) {
		this.boxes[box].style.display = this.boxes[box].style.display=="none"?"block":"none";
		this.boxLink[box].innerHTML = (this.boxes[box].style.display=="none"?"Show ":"Hide ")+this.boxText[box];
	};
	p.newToggleBox = function(fun,target,text,target2) {
		if(this.boxes == undefined) {
			this.boxes = {};
			this.boxText = {};
			this.boxLink = {};
			this.boxId = 0;
		}
		var id = 'pfc_extra_box_'+this.boxId;
		this.boxId = this.boxId + 1;
		this.boxLink[id] = addElem('a',target,{onclick:'pfc.toggleBox("'+id+'");'},"Show "+text);
		addElem('br',target);
		this.boxText[id] = text;
		this.boxes[id] = addElem('div',target2!=undefined?target2:target,{id:id});
		this.boxes[id].style.display = "none";
		this.boxes[id].style.border = '1px solid #555555';
		this.boxes[id].style.backgroundColor = '#ffffff';
		this.boxes[id].style.padding = '4px';
		var fun = fun.bind(this);
		fun(id);
	};

	p.newCodeArea = function(def,load,save,target) {
		if(this.customCode == undefined) {
			this.customCode = {};
			this.customCodeFunc = {};
			this.customCodeFuncDefault = {};
			this.customCodeError = {};
			this.customCodeSave = {};
			this.customCodeId = 0;
		}
		var id = 'pfc_extra_code_frag_'+this.customCodeId;
		this.customCodeId = this.customCodeId + 1;

		this.customCodeSave[id] = save;
		var f = eval('var _='+def+';_');
		this.customCodeFunc[id] = f;
		this.customCodeFuncDefault[id] = f;
		this.newToggleBox(function(bid) {
			this.customCode[id] = addElem('textarea', bid, {id: id+'_textfield'});
			this.customCode[id].style.height = '350px';
			this.customCode[id].style.width = '100%';
			this.customCode[id].innerHTML = load(def);
			this.customCodeError[id] = addElem('textarea', bid, {id: id+'_errorfield', readonly: true});
			this.customCodeError[id].style.height = '40px';
			this.customCodeError[id].style.width = '100%';
			addElem('button', bid, {type: 'button', onclick: 'pfc.updateCode("'+id+'");'}, "Compile Code");
		}, target, 'Code Editor');
		this.updateCode(id);
		return id;
	};
	p.updateCode = function(id) {
		this.customCodeError[id].innerHTML = 'Compiling..';
		try {
			this.customCodeFunc[id] = eval('var _='+this.customCode[id].value+';_').bind(this);
			this.customCodeError[id].innerHTML = 'Successfully compiled';
			this.customCodeSave[id](this.customCode[id].value);
		} catch(e) {
			this.customCodeFunc[id] = this.customCodeFuncDefault[id];
			this.customCodeError[id].innerHTML = 'Error encountered:\n'+e.toString();
		}
	};
	p.getFunction = function(id) {
		return this.customCodeFunc[id];
	};

	p.getColor = function(nick) {
		if(!this.nickColor.checked) return this.color.value;
		else if(nick in this.rpColor) return this.rpColor[nick];
		else return this.color.value;
	};

	var re_removeSpaces = new RegExp('^[ ]*$','g');
	var re_commandProcess = new RegExp('^(\/[a-zA-Z0-9]+)( (.*)|)');
	p.callbackWords_OnKeypress = function(evt) {
		var code = (evt.which) ? evt.which : evt.keyCode;
		if (code == Event.KEY_RETURN) {			
			this.evt = evt;
			var shift = (evt.shiftKey) ? '1' : '0';
			var alt = (evt.altKey || evt.ctrlKey) ? '1' : '0';
			var code = shift+alt;
			if(this.el_words.value.replace(re_removeSpaces,'')=='') 
				var msg = '';
			else if(this.el_words.value.match(re_commandProcess))
				var msg = this.el_words.value; 
			else if(this.autoRp[code]!=undefined)
				var msg = sprintf(this.rpAutoFormat.value,this.autoRp[code],this.el_words.value);
			else
				var msg = this.el_words.value;
			return this.doSendMessage(this.autoRp[code],msg,this.el_words);
		}
		else return true;
	};

	p.setupRPNickBox = function(id) {
		addElem('div',id,{id:'pfc_extra_rpnames'});
		this.updateRPNickBox();
		this.updateRPColorList();
		addElem('button',id,{
			type:'button',
			onclick:'pfc_extra.setRpNamesSize(pfc_extra.getRpNamesSize()+1);'+
				'pfc_extra.setRpColorsSize(pfc_extra.getRpColorsSize()+1);'+
				'pfc.updateRPNickBox();'+
				'pfc.updateRPColorList();'
		},'Add Entry');
		addElem('button',id,{
			type:'button',
			onclick:'if(pfc_extra.getRpNamesSize()==1) { alert("Cannot remove last entry"); } else {'+
				'pfc_extra.setRpNamesSize(pfc_extra.getRpNamesSize()-1);'+
				'pfc_extra.setRpColorsSize(pfc_extra.getRpColorsSize()-1);'+
				'pfc.updateRPNickBox();'+
				'pfc.updateRPColorList();'+
				'}'
		},'Remove Entry');
	};
	p.updateRPNickBox = function() {
		var id = 'pfc_extra_rpnames';

		var c1 = pfc_extra.getRpNamesSize();
		var c2 = pfc_extra.getRpColorsSize();
		if(c1!=c2) {
			var n = Math.max(c1,c2);
			pfc_extra.setRpNamesSize(n);
			pfc_extra.setRpColorsSize(n);
		}

		var count = pfc_extra.getRpNamesSize();
		getElem(id).innerHTML='';

		addElem('span',id,{id:'pfc_extra_rpnames_count'},count).style.display='none';

		var table_id = 'pfc_extra_rpnames_table';
		addElem('table',id,{id:table_id});

		var table_row_id = 'pfc_extra_rpnames_header';
		addElem('tr',table_id,{id:table_row_id});

		addElem('td',table_row_id,{},'Name');
		addElem('td',table_row_id,{},'Color');

		this.rpColors = {};
		this.rpNames = {};

		for(var i=0;i<count;i++) {
			var table_row_id = 'pfc_extra_rpnames_row_'+i;
			addElem('tr',table_id,{id:table_row_id});

			var table_cell_id = 'pfc_extra_rpnames_cell0_'+i;
			var table_input_id = 'pfc_extra_rpnames_name_'+i;
			addElem('td',table_row_id,{id:table_cell_id});
			(this.rpNames[i] = addElem('input',table_cell_id,{
				id: table_input_id,
				onchange: 'pfc_extra.setRpNames('+i+',pfc.rpNames['+i+'].value);pfc.updateRPColorList();',
				value: pfc_extra.getRpNames(i,'')
			})).style.width='100%';
			this.rpNames[i].readOnly=!this.nickColor.checked;

			var table_cell_id = 'pfc_extra_rpnames_cell1_'+i;
			var table_input_id = 'pfc_extra_rpnames_color_'+i;
			addElem('td',table_row_id,{id:table_cell_id});
			(this.rpColors[i] = addElem('input',table_cell_id,{
				id: table_input_id,
				onchange: 'pfc_extra.setRpColors('+i+',pfc.rpColors['+i+'].value);pfc.updateRPColorList();',
				value: pfc_extra.getRpColors(i,'')
			})).style.width='100%';
			this.rpColors[i].readOnly=!this.nickColor.checked;
		}
	};
	p.updateRPColorList = function() {
		this.rpColor = {};
		var l = getElem('pfc_extra_rpnames_count').innerHTML;
		for(var i=0;i<l;i++)
			this.rpColor[this.rpNames[i].value]=this.rpColors[i].value;
	}

	p.initHook = function() {
		debugprint("Init");

		this.el_handle.style.fontWeight = 'normal';
		this.autoRp = {};
		this.autoRp['00'] = pfc_extra.getARP00(undefined);
		this.autoRp['01'] = pfc_extra.getARP01(undefined);
		this.autoRp['10'] = pfc_extra.getARP10(undefined);
		this.autoRp['11'] = pfc_extra.getARP11(undefined);

		removeElem('pfc_bt_color_btn');
		this.newToggleBox(function(id) {
			this.newToggleBox(function(id) {
				addElem('span',id,{},'Enable Text Color: ');
				this.useColor = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setUseColor(pfc.useColor.checked);'+
						  'pfc.color.readOnly=!pfc.useColor.checked;'
				});
				this.useColor.checked = pfc_extra.getUseColor(true);

				addElem('br',id);

				addElem('span',id,{},'Color: ');
				this.color = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getColor(initColor),
					onchange: 'pfc_extra.setColor(pfc.color.value);'
				});
				this.color.readOnly=!this.useColor.checked;
			}, id, 'Text Color');
			this.newToggleBox(function(id) {
				addElem('span',id,{},'Enable RP Mode: ');
				this.enableRP = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setEnableRp(pfc.enableRP.checked);'+
						  'pfc.rpRegex.readOnly=!pfc.enableRP.checked;'+
						  'pfc.rpRepNick.readOnly=!pfc.enableRP.checked;'+
						  'pfc.rpRepMsg.readOnly=!pfc.enableRP.checked;'+
						  'pfc.rpAutoFormat.readOnly=!pfc.enableRP.checked;'
				});
				this.enableRP.checked = pfc_extra.getEnableRp(false);

				addElem('br',id);

				addElem('span',id,{},'RP Matching Regex: ');
				this.rpRegex = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getRpRegex('^(([^ ]+): .*)$'),
					onchange: 'pfc_extra.setRpRegex(pfc.rpRegex.value);'
				});
				this.rpRegex.readOnly=!this.enableRP.checked;

				addElem('br',id);

				addElem('span',id,{},'RP Nick Replace String: ');
				this.rpRepNick = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getRpRepNick('$2'),
					onchange: 'pfc_extra.setRpRepNick(pfc.rpRepNick.value);'
				});
				this.rpRepNick.readOnly=!this.enableRP.checked;


				addElem('br',id);

				addElem('span',id,{},'RP Message Replace String: ');
				this.rpRepMsg = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getRpRepMsg('$1'),
					onchange: 'pfc_extra.setRpRepMsg(pfc.rpRepMsg.value);'
				});
				this.rpRepMsg.readOnly=!this.enableRP.checked;

				addElem('br',id);

				addElem('span',id,{},'Auto RP Format String: ');
				this.rpAutoFormat = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getRpAutoFormat('%s: %s'),
					onchange: 'pfc_extra.setRpAutoFormat(pfc.rpAutoFormat.value);'
				});
				this.rpAutoFormat.readOnly=!this.enableRP.checked;

				addElem('br',id);

				addElem('span',id,{},'Use notice for /rpme: ');
				this.rpmeNotice = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setRpmeNotice(pfc.rpmeNotice.checked);'+
						  'pfc.rpmeFormat.readOnly=pfc.rpmeNotice.checked;'
				});
				this.rpmeNotice.checked = pfc_extra.getRpmeNotice(false);

				addElem('br',id);

				addElem('span',id,{},'/rpme format: ');
				this.rpmeFormat = addElem('input', id, {
					type: 'text',
					value: pfc_extra.getRpmeFormat('[i]%s %s[/i]'),
					onchange: 'pfc_extra.setRpmeFormat(pfc.rpmeFormat.value);'
				});
				this.rpmeFormat.readOnly=this.rpmeNotice.checked;
			}, id, 'RP Settings');
			this.newToggleBox(function(id) {
				addElem('span',id,{},'Enable Per-Nick Color: ');
				this.nickColor = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setNickColor(pfc.nickColor.checked);'+
						  'pfc.updateRPNickBox();'
				});
				this.nickColor.checked = pfc_extra.getNickColor(true);

				addElem('hr',id);
				this.setupRPNickBox(id);
			}, id, 'Per-Nick Color');
			this.newToggleBox(function(id) {
				addElem('span',id,{},'Send Smilies: ');
				this.useSmilies = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setUseSmilies(pfc.useSmilies.checked);'
				});
				this.useSmilies.checked = pfc_extra.getUseSmilies(true);

				addElem('br',id);

				addElem('span',id,{},'Process /me: ');
				this.meProcess = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setMeProcess(pfc.meProcess.checked);'
				});
				this.meProcess.checked = pfc_extra.getMeProcess(false);

				addElem('br',id);

				addElem('span',id,{},'Use /notice for /me: ');
				this.meNotice = addElem('input', id, {
					type: 'checkbox',
					onchange: 'pfc_extra.setMeNotice(pfc.meNotice.checked);'
				});
				this.meNotice.checked = pfc_extra.getMeNotice(false);
			}, id, 'Text Options');

			this.newToggleBox(function(id) {
				addElem('span',id,{},'Custom filter code: ');
				this.addProcess = this.newCodeArea('function(text,nick){\n\treturn text;\n}', pfc_extra.getTextCode, pfc_extra.setTextCode, id);

				addElem('span',id,{},'Custom command handler: ');
				this.addCommand = this.newCodeArea(
					'function(cmd,param,nick){'+
					'\n\tif(cmd=="/hello") {\n\t\tthis.displayMsg("","Hello, world!");\n\t\treturn true;\n\t}'+
					'\n\treturn false;\n}', 
				pfc_extra.getCommandCode, pfc_extra.setCommandCode, id);
			}, id, 'Custom Hooks');

			addElem('hr',id,{});

			addElem('a',id,{
				onclick: 'pfc.resetChat(false);'
			},'Reset Chat');

			addElem('br',id,{});

			addElem('a',id,{
				onclick: 'pfc.resetChat(true);'
			},'Disable PFC Extra');
		}, 'pfc_bbcode_container', 'Options', 'pfc_input_container');
		addElem('div','pfc_input_container').style.height='3px';

		this.regenHandle();

		debugprint("End Init");
	};
	p.resetChat = function(d) {
		var parent = getElem('pfc_container').parentNode;
		removeElem('pfc_container');
		addElem('div',parent,{id:'pfc_loader'},loading);

		pfc_clientid=(pfc_clientid+' pfc_extra '+new Date().getTime()).md5();
		clearTimeout(this.timeout);

		this.reset = true;

		if(d) {
			clone(disable,pfcClient.prototype);
			addElem('div',parent,{id:'pfc_container'}).style.display='none';
		} else clone(p,pfcClient.prototype);

		pfc=new pfcClient();
		pfc.__loading = parent;
		pfc.loadChat(pfc_theme);
	}

	p.handleResponsePre = function(cmd, resp, param) {
	};
	p.handleResponsePost = function(cmd, resp, param) {
		if(cmd=='nick') this.regenHandle();
	};
	
	p.regenHandle = function() {
		if(!getElem('pfc_extra_handleMarker')) {
			var nick = this.el_handle.innerHTML;
		} else {
			var nick = getElem('pfc_extra_handleMarker').innerHTML;
		}

		this.el_handle.innerHTML = '';

		var elem = addElem('span',this.el_handle,{},nick).style.fontWeight = 700;
		if(this.autoRp['00']) {
			addElem('span',this.el_handle,{},' ['+this.autoRp['00']+']');
		}
		var elem = addElem('span',this.el_handle,{id:'pfc_extra_handleMarker'},nick).style.display = 'none';
	}

	/*----------\
	| Hook code |
	\----------*/

	p.insertSmiley = function(smiley) {
		var w = this.el_words;

		smiley = this.processSmiley(smiley);
		if (w.setSelectionRange) {
			var s = w.selectionStart;
			var e = w.selectionEnd;
			w.value = w.value.substring(0, s) + smiley + w.value.substr(e);
			w.setSelectionRange(s + smiley.length, s + smiley.length);
			w.focus();
		} else {
			w.value += smiley;
			w.focus();
		}
	};

	p.loadChat = function() {
		new Ajax.Request(pfc_server_script_url, {
			method: 'get',
			parameters: {pfc_ajax: 1, f: 'loadChat'},
			onSuccess: function(transport) {
				if(this.__loading) {
					addElem('div',this.__loading,{id:'pfc_container'});
				}

				//Sometimes, the server tries to eval code that overrides various prototype things...
				var fakeScope = {
					pfcClient: {
						prototype: {}
					}
				}
				with(fakeScope) {
					try {
						eval(transport.responseText);
					} catch(e) {
						alert("Client load failed:\n"+e);
					}
				}
				for(k in fakeScope.pfcClient.prototype) {
					if(defined[k]) {
						debugprint("Warning: Server tried to override hooked method "+k+'. Denied');
					} else {
						debugprint("Warning: Server overrode "+k);
						pfcClient.prototype[k] = fakeScope.pfcClient.prototype[k];
					}
				}

				try {
					this.initHook();
				} catch(e) {
					alert("Client load failed:\n"+e);
				}
			}.bind(this)
		});
	};

	p.handleResponse_ = function(cmd, resp, param) {
		this.handleResponsePre(cmd, resp, param); 
		var ret = this.handleResponse(cmd, resp, param);
		this.handleResponsePost(cmd, resp, param); 
		return ret;
	};

	p.doSendMessage = function(nick,msg,w) {
		var wval = undefined;
		if(msg==undefined) {
			w = this.el_words;
			wval = w.value;
		} else {
			wval = msg;
		}
		if(nick==undefined) {
			if(this.enableRP.checked) {
				var e = new RegExp(this.rpRegex.value);
				if(wval.match(e)) {
					var nick = wval.replace(e,this.rpRepNick.value);
					return this.doSendMessage(nick,wval.replace(e,this.rpRepMsg.value),w);
				}
			}
			nick = this.nickname;
		}

		this.cmdhistory.push(wval);
		this.cmdhistoryid = this.cmdhistory.length;
		this.cmdhistoryissearching = false;

		if (wval.match(re_commandProcess)) {
			var cmd = wval.replace(re_commandProcess, '$1');
			var param = wval.replace(re_commandProcess, '$3');
			if(this.cmdHook(cmd,param,nick)) {		
				this.sendRequest(cmd +' '+ param.substr(0, pfc_max_text_len + 2*this.clientid.length));
			}
		} else {
			wval = wval.replace(re_removeSpaces,'');
			if(wval=="") return false;
			wval = wval.substr(0,pfc_max_text_len);
			wval = this.process(wval,nick);
			this.sendRequest('/send '+wval);
		}
		if(w!=undefined) w.value = '';
		return false;
	};

	var re_processCode = new RegExp('^([a-zA-Z0-9.]+?)\\((.*?)\\)$');
	p.sendRequest = function(cmd, recipientid) {
		if (cmd == '/update' && this.pfc_ajax_connected) return;
		var delay = this.calcDelay();

		if (cmd != "/update") {
			clearTimeout(this.timeout);
			this.timeout = setTimeout('pfc.updateChat(true)', delay);
			this.timeout_time = new Date().getTime() + delay;

			if (pfc_debug) trace('sendRequest: '+cmd);
		}

		var rx = new RegExp('(^\/[^ ]+) *(.*)','ig');
		if (!recipientid) recipientid = this.gui.getTabId();
		cmd = cmd.replace(rx, '$1 '+this.clientid+' '+(recipientid==''?'0':recipientid)+' $2');

		var url = pfc_server_script_url;
		new Ajax.Request(url, {
			method: 'post',
			parameters: {'pfc_ajax':1, 'f':'handleRequest', 'cmd': cmd },
			onCreate: function(transport) {
				this.pfc_ajax_connected = true; 
				this.last_request_time = new Date().getTime();
			}.bind(this),
			onSuccess: function(transport) {
				if (!transport.status) return;
				if(!this.__nonmatching) this.__nonmatching = Array();

				if(this.reset) return;

				this.last_response_time = new Date().getTime();
				var code = transport.responseText.split(';\n').map(function(string){ 
					return string.replace(new RegExp("^(.*);$"),"$1"); 
				});
				for(var i=0;i<code.length;i++) {
					if(!code[i].match(re_processCode)) {
						debugprint("Nonmatching code: "+code[i]);
						if(debug) this.__nonmatching.push(code[i]);
						var c = code[i];
					} else {
						var c = code[i].replace(re_processCode,"pfc.processCall('$1',Array($2))");
					}

					try {
						eval(c);
					} catch(e) {
						if(debug) alert("internal error: "+e+'\n'+code[i]+'\n'+c);
						throw e;
					}
				}
			}.bind(this),
			onComplete: function(transport) {
				this.pfc_ajax_connected = false;

				this.ping = Math.abs(this.last_response_time - this.last_request_time);
				if ($('pfc_ping')) $('pfc_ping').innerHTML = this.ping+'ms'+' ['+parseInt(this.calcDelay() / 1000)+'s]';
			}.bind(this)
		});
	};
	p.processCall = function(cmd, params) {
		if(!this.__used_functions) this.__used_functions = {};
		if(debug) this.__used_functions[cmd]=true;

		if(cmd=='pfc.handleResponse') {
			this.handleResponse_.apply(this,params);
		} else {
			var s = cmd.split('.');
			var c = s.length==1?undefined:eval(s.slice(0,s.length-1).join('.'));
			var f = eval(cmd);

			f.apply(c,params);
		}
	};

	for(k in p) defined[k] = true;
	for(k in pfcClient.prototype) if(p[k]==undefined) p[k] = pfcClient.prototype[k];

	/*----------------------\
	| Older Version Patches |
	\----------------------*/
	if(typeof pfc_loadChat != "undefined") { //Hack for certain old versions? http://www.zoogaloos.com/chat.php required this.
		window.onload = function() {
			pfc = new pfcClient();
			if(pfc_isready) pfc.loadChat();
		}
	}

	var patch = {};
	patch.calcDelay = function() {
		return 2000;
	};
	for(k in patch) if(!p[k]) {
		debugprint(k+' not found, patching');
		p[k] = patch[k];
	};

	clone(p,pfcClient.prototype);

	debugprint('PFC Extra loaded');
}

var t = {};
var re_cleanName = new RegExp('[^a-zA-Z0-9_]','g');
var contains = function(arr,obj) {
    var i = arr.length;
    while (i--) if (arr[i] === obj) return true;
    return false;
}

var addPersist = function(n) {
	var f="_"+window.location.hostname.replace(re_cleanName,"_")+"$"+n;
	//var f = n;
	var hasValue = GM_getValue(f,1)==GM_getValue(f,2);
	var value = GM_getValue(f);
	t["set"+n]=function(v) {
		setTimeout(function() {
			GM_setValue(f,v);
		},0);
		value = v;
		hasValue = true;
	};
	t["get"+n]=function(v) {
		return hasValue?value:v;
	};
	t["delete"+n]=function() {
		setTimeout(function() {
			GM_deleteValue(f);
		},0);
		value = undefined;
		hasValue = false;
	};
};
var addPersistArray = function(n,s) {
	var f="_"+window.location.hostname.replace(re_cleanName,"_")+"$Array$"+n+"$";
	var values = {};
	var hasValue = {};
	var size = GM_getValue(f+"size",s);
	for (var i=0;i<size;i++) {
		var value = GM_getValue(f+i);
		if(value!=undefined) {
			values[i]=value;
			hasValue[i]=true;
		}
	}
	t["set"+n]=function(n,v) {
		if(n>=size || n<0) throw "Invalid array index";
		setTimeout(function() {
			GM_setValue(f+n,v);
		},0);
		values[n]=v;
		hasValue[n]=v;
	};
	t["get"+n]=function(n,v) {
		if(n>=size || n<0) throw "Invalid array index";
		return hasValue[n]?values[n]:v;
	};
	t["set"+n+"Size"]=function(s) {
		if(s<size) for(var i=s;i<size;i++) {
			setTimeout(function() {
				GM_deleteValue(f+i);
			},0);
			delete values[i];
			delete hasValue[i];
		}
		setTimeout(function() {
			GM_setValue(f+"size",s);
		},0);
		size = s;
	};
	t["get"+n+"Size"]=function() {
		return size;
	};
};
addPersist("UseColor");
addPersist("Color");
addPersist("MeProcess");
addPersist("MeNotice");
addPersist("UseSmilies");
addPersist("TextCode");
addPersist("CommandCode");
addPersist("NickColor");

addPersist("EnableRp");
addPersist("RpRegex");
addPersist("RpRepNick");
addPersist("RpRepMsg");
addPersist("RpAutoFormat");
addPersist("RpmeNotice");
addPersist("RpmeFormat");

addPersist("ARP00");
addPersist("ARP10");
addPersist("ARP01");
addPersist("ARP11");

addPersistArray("RpNames",10);
addPersistArray("RpColors",10);
unsafeWindow.pfc_extra = t;

var loadScript = function(script,elem) {	
	var s = document.createElement('script');
	s.type = 'text/javascript';
	s.src = script;
	elem.appendChild(s);
};
var loadText = function(func,elem) {
	var s = document.createElement('script');
	s.type = 'text/javascript';
	s.innerHTML = func;
	elem.appendChild(s);
};

loadScript('http://www.strictly-software.com/scripts/downloads/encoder.js',document.head);
loadScript('https://dl.dropbox.com/u/49064620/sprintf-0.6.js',document.head);

loadText(__pfc_extra_hook.toString()+'\n\n'+'__pfc_extra_hook();',document.body);
