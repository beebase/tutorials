/** MediaManager
 *	Opens the choosen media / file manager and get the transmitted file name
 *
 *	Options :
 *
 *		baseUrl:			URL to the website
 *		parent:				type of the parent. 'article', 'page', etc. Used to update the database table.                 
 *		idParent:			ID of the parent element      
 *		pictureContainer:	The picture container DOM element 
 *		musicContainer:		The MP3 list container DOM element
 *		videoContainer:		The video list container DOM element
 *		button:				DOM opener button name
 *		mode:				'tinyBrowser' : Using the tinyBrowser plugin to browse files
 *							'mcFileManager' : Using MoxeCode MceImageManager / MceFileManager to browse files
 */

var IonizeMediaManager = new Class(
{
	Implements: Options,

    options: {
		parent:			false,
		idParent:		false,
		mode:			'',								// 'mcFileManager', 'tinyBrower', 'ezfilemanager', 'kcfinder',
		musicArray:		Array('mp3'),					// Array of authorized files extensions
		pictureArray:	Array('jpg', 'gif', 'png', 'jpeg'),
		videoArray:		Array('flv', 'fv4'),
		fileArray:		Array(),
		thumbSize:		120
    },

	initialize: function(options)
	{
		this.setOptions(options);
		
		this.baseUrl =		this.options.baseUrl;

		this.adminUrl =		this.options.adminUrl;
		
		this.themeUrl =		theme_url;

		this.idParent =		options.idParent;
		this.parent =		options.parent;

		// Containers storing
		this.containers = 	new Hash({
							 'picture' : options.pictureContainer,
							 'music' : options.musicContainer,
							 'video': options.videoContainer,
							 'file': options.fileContainer
							});
		// Filemanager mode
//		this.mode =			options.mode;
		this.mode = 'mootools-filemanager';

		// Filemanager opening buttons
		var self = this;
		$$(options.fileButton).each(function(item)
		{
			item.addEvent('click', function(e)
			{
				e.stop();
				self.toggleFileManager();
			});
		});
		
		// Check if a fileManager is already open. If yes, change the callback ref.
		// Needed in case of page / article change with the filemanager open
		if ($('filemanagerWindow'))
		{
			var self = this;
			
			filemanager.removeEvents('complete');
			
			filemanager.setOptions(
			{
				'onComplete': self.addMedia.bind(self)
			});
		}
	},
	
	initParent: function(parent, id_parent)
	{
		this.parent = parent;
		this.idParent = id_parent;
	},
	
	/**
	 * Adds one medium to the current parent
	 * Called by callback by the file / image manager
	 * 
	 * @param	string	Complete URL to the media. Slashes ('/') were replaced by ~ to permit CI management
	 *
	 */
	addMedia:function(url, file) 
	{
		// File extension
		var extension = (url.substr(url.lastIndexOf('.') + 1 )).toLowerCase();

		// Check media type regarding the extension
		var type = false;
		if (this.options.pictureArray.contains(extension)) { type='picture';}
		if (this.options.musicArray.contains(extension)) { type='music';}
		if (this.options.videoArray.contains(extension)) { type='video';}
		if (this.options.fileArray.contains(extension)) { type='file';}

		// Media type not authorized : error message
		if (type == false)
		{
			ION.notification('error', Lang.get('ionize_message_media_not_authorized') + ' : ' + extension);
		}
		else
		{
			// Complete relative path to the media
//			var path =	url.replace(/\//g, "~");

			// Send the media to link
			var xhr = new Request.JSON(
			{
				'url': this.adminUrl + 'media/add_media/' + type + '/' + this.parent + '/' + this.idParent, 
				'method': 'post',
				'data': 'path=' + url,
				'onSuccess': this.successAddMedia.bind(this), 
				'onFailure': this.failure.bind(this)
			}).send();
		}
	},


	/**
	 * called after 'addMedia()' success
	 * calls 'loadMediaList' with the correct media type returned by the XHR call
	 *
	 */
	successAddMedia: function(responseJSON, responseText)
	{
		ION.notification(responseJSON.message_type, responseJSON.message);

		// Media list reload
		if (responseJSON.type)
		{
			this.loadMediaList(responseJSON.type);
		}
	},


	/**
	 * Loads a media list through XHR regarding its type
	 * called after a media list loading through 'loadMediaList'
	 *
	 * @param	string	Media type. Can be 'picture', 'music', 'video', 'file'
	 *
	 */
	loadMediaList: function(type)
	{
		// Only loaded if a parent exists
		if (this.idParent)
		{
			var myAjax = new Request.JSON(
			{
				'url' : this.adminUrl + 'media/get_media_list/' + type + '/' + this.parent + '/' + this.idParent,
				'method': 'get',
				'onFailure': this.failure.bind(this),
				'onComplete': this.completeLoadMediaList.bind(this)
			}).send();
		}
	},

	
	/**
	 * Initializes the media list regarding to its type
	 * called after a media list loading through 'loadMediaList'
	 *
	 * @param object	JSON response object
	 * responseJSON.type : media type. Can be 'picture', 'video', 'music', 'file'
	 * responseJSON.content :
	 *
	 */
	completeLoadMediaList: function(responseJSON, responseText)
	{
		// Hides the spinner
		MUI.hideSpinner();
		var container;
		// Receiver container
		var cname = this.containers.get(responseJSON.type);
		if (cname)
			container = $(cname);
		else
		{
			console.log( "completeLoadMediaList in ionize_mediamanager.js -> container undefined...");
			return;
		}
		
		if (typeOf(container) != 'null')
		{
			container.empty();

			if (responseJSON && responseJSON.content)
			{
				// Feed the container with responseJSON content
				container.set('html', responseJSON.content);
	
				var self = this;
	
				// Init the sortable
				sortableMedia = new Sortables(container, {
					revert: true,
					handle: '.drag',
					clone: true,
					container: container,
					opacity: 0.5,
					onComplete: function()
					{
						var serialized = this.serialize(0, function(element, index)
						{
							// Get the ID list by replacing 'type_' by '' for each item
							// Example : Each picture item is named 'picture_ID' where 'ID' is the media ID
							if (element.id !== '')
							{
								return (element.id).replace(responseJSON.type + '_','');
							}
						});
						// Items sorting
						self.sortItemList(responseJSON.type, serialized);
					}
				});
	
				// Store the first ordering after picture list load
				container.store('sortableOrder', sortableMedia.serialize(0, function (element, index)
				{
					return element.getProperty('id').replace(responseJSON.type + '_','');
				}));
	
				// Set tips
				new Tips('#' + this.containers.get(responseJSON.type) + ' .help', {'className' : 'tooltip'});
			}
			// If no media, feed the content HMTLDomElement with transmitted message
			else
			{
			//	container.set('html', responseJSON.message);
			}
	
			// Add the media number to the tab
			ION.updateTabNumber(responseJSON.type + 'Tab', container.getProperty('id'));
		}
	},


	/** 
	 * Items list ordering
	 * called on items sorting complete
	 * calls the XHR server ordering method
	 *
	 * @param	string	Media type. Can be 'picture', 'video', 'music', 'file'
	 * @param	string	new order as a string. coma separated
	 *
	 */
	sortItemList: function(type, serialized)
	{
		var container = $(this.containers.get(type));
		var sortableOrder = container.retrieve('sortableOrder');

		// Remove "undefined" from serialized. Undefined comes from the clone, which isn't removed before serialize.
		var serie = [];
		serialized.each(function(item)
		{
			if (typeOf(item) != 'null')
				serie.push(item);
		});

		// If current <> new ordering : Save it !
		if (sortableOrder.toString() != serie.toString() )
		{
			// Store the new ordering
			container.store('sortableOrder', serie);

			// Save the new ordering
			var myAjax = new Request.JSON(
			{
				url: this.adminUrl + 'media/save_ordering/' + this.parent + '/' + this.idParent,
				method: 'post',
				data: 'order=' + serie,
				onSuccess: function(responseJSON, responseText)
				{
					MUI.hideSpinner();
					
					ION.notification(responseJSON.message_type, responseJSON.message);
				}
			}).post();
		}
	},



	/** 
	 * Called when one request fails
	 */
	failure: function(xhr)
	{
		ION.notification('error', xhr.responseText );

		// Hide the spinner
		MUI.hideSpinner();
	},


	/**
	 * Unlink one media from his parent
	 *
	 * @param	string	Media type
	 * @param	string	Media ID
	 *
	 */
	detachMedia: function(type, id) 
	{
		// Show the spinner
		MUI.showSpinner();
		
		var xhr = new Request.JSON(
		{
			url: this.adminUrl + 'media/detach_media/' + type + '/' + this.parent + '/' + this.idParent + '/' + id,
			method: 'post',
//			onSuccess: this.disposeMedia.bind(this),
			onSuccess: function()
			{
				this.loadMediaList(type);
			}.bind(this),
			onFailure: this.failure.bind(this)
		}).send();
	},


	/**
	 * Unlink all media from a parent depending on the type
	 *
	 * @param	string	Media type. Can be 'picture', 'music', 'video', 'file'
	 *
	 */	
	detachMediaByType: function(type)
	{
		// Show the spinner
		MUI.showSpinner();
		
		var xhr = new Request.JSON(
		{
			url: this.adminUrl + 'media/detach_media_by_type/' + this.parent + '/' + this.idParent + '/' + type,
			method: 'post',
			onSuccess: function(responseJSON, responseText)
			{
				$(this.containers.get(type)).empty();
				
				// Message
				ION.notification(responseJSON.message_type, responseJSON.message);
				
				// Hides the spinner
				MUI.hideSpinner();
				
			}.bind(this),
			onFailure: this.failure.bind(this)
		}).send();
	},

	
	/**
	 * Dispose one HTMLDomElement
	 *
	 * @param	object	JSON XHR request answer
	 * @param	object	Text XHR request answer
	 *
	 */
	disposeMedia: function(responseJSON, responseText)
	{
		// HTMLDomElement to dispose
		var el = responseJSON.type + '_' + responseJSON.id;
		
		if ( responseJSON.id && $(el))
		{
			$(el).dispose();
			ION.notification('success', responseJSON.message);		
		}
		else
		{
			ION.notification('error', responseJSON.message);
		}
		
		MUI.hideSpinner();
	},


	/** 
	 * Init thumbnails for one picture
	 * to be called on pictures list
	 * @param	string	picture ID
	 *
	 */
	initThumbs:function(id_picture) 
	{
		// Show the spinner
		MUI.showSpinner();

		var myAjax = new Request.JSON(
		{
			url: this.adminUrl + 'media/init_thumbs/' + id_picture,
			method: 'post',
			onSuccess: function(responseJSON, responseText)
			{
				ION.notification(responseJSON.message_type, responseJSON.message );
				
				if (responseJSON.message_type == 'success')
				{
					this.loadMediaList('picture');
				}
			}.bind(this)
		}).send();
	},


	/** 
	 * Init all thumbs for one parent
	 *
	 */
	initThumbsForParent: function()
	{
		// Show the spinner
		MUI.showSpinner();
		
		var myAjax = new Request.JSON(
		{
			url: this.adminUrl + 'media/init_thumbs_for_parent/' + this.parent + '/' + this.idParent,
			method: 'get',
			onSuccess: function(responseJSON, responseText)
			{
				ION.notification(responseJSON.message_type, responseJSON.message );
				
				if (responseJSON.message_type == 'success')
				{
					this.loadMediaList('picture');
				}
			}.bind(this)	
		}).send();
	},
	
	
	/** 
	 * Opens fileManager
	 *
	 */
	toggleFileManager:function() 
	{
		// If no parent exists : don't show the filemanager but an error message	
		if ( ! this.idParent || this.idParent == '')
		{
			ION.notification('error', Lang.get('ionize_message_please_save_first'));
		}
		else
		{
			switch (this.mode)
			{
				case 'filemanager': 
					mcImageManager.init({
						remove_script_host : false,
						iframe : false
					});
					mcImageManager.open('fileManagerForm','hiddenFile', false, this.addMedia.bind(this));
					break;
				
				case 'ezfilemanager':
					
					var url = this.themeUrl + 'javascript/tinymce/jscripts/tiny_mce/plugins/ezfilemanager/ezfilemanager.php?type=file&sa=1';
					var xPos = (window.screen.availWidth/2) - (w/2);
					var yPos = 60;
					var config = 'width=750, height=450, left='+xPos+', top='+yPos+', toolbar=no, menubar=no, scrollbars=yes, resizable=yes, location=no, directories=no, status=no';
					var w = window.open(url, 'filemanager', config);
					w.focus();
					break;

                case 'kcfinder':

                    var url = this.themeUrl + 'javascript/kcfinder/browse.php?type=pictures&lng='+Lang['current'];+'&noselect=1&opener=custom';
                    var xPos = (window.screen.availWidth/2) - (750/2);
                    var yPos = window.screen.availHeight/4;
                    var config = 'width=750, height=450, left='+xPos+', top='+yPos+', toolbar=no, menubar=no, scrollbars=yes, resizable=yes, location=no, directories=no, status=no';
                    window.KCFinder = {};
                    window.KCFinder.media = this;
                    window.KCFinder.callBack = function(url) {
                        window.KCFinder.media.addMedia(url);
                        window.KCFinder = null;
                    };
                    var w = window.open(url, 'kcfinder', config);
                    w.focus();
                    break;

				case 'mootools-filemanager':
					
					// Init of the FileManager is done in the desktop.php view.

					// Exit if another fileManager is already running
					if ($('filemanagerWindow'))
					{
						var inst = $('filemanagerWindow').retrieve('instance');
						
						// Re-open window if minimized or shake if triing to open another FM
						if (inst.isMinimized) 
						{
							inst.restore();
						}
						else
						{
							$('filemanagerWindow').shake(); 
						}

						return;
					}

					// Referer to ionizeMediaManager
					var self = this;
					
					// First try to get a tokken : The tokken is only returned if the user is connected.
					var xhr = new Request.JSON(
					{
						url: admin_url + 'media/get_tokken',
						method: 'post',
						onSuccess: function(responseJSON, responseText)
						{
							// Open the filemanager if the tokken isn't empty
							if (responseJSON && responseJSON.tokken != '')
							{
								// Correct windows levels : Get the current highest level.			
								MUI.Windows._getWithHighestZIndex();							// stores the highest level in MUI.highestZindex
								var zidx = (MUI.Windows.highestZindex).toInt();
								
								MUI.Windows.indexLevel = zidx + 100;						// Mocha window z-index
// See how to do that
//								this.SwiffZIndex = zidx + 200;								// Uploader index
//								document.id(this.tips).setStyle('zIndex', zidx + 500);		// Tips
								
								// fileManager init
								filemanager = new FileManager({
									url: admin_url + 'media/filemanager',
									URLpath4assets: theme_url + 'javascript/mootools-filemanager/Assets',
//									assetBasePath: theme_url + 'javascript/mootools-filemanager/Assets',
									standalone: false,
									thumbSmallSize: 120,
									createFolders: true,
									destroy: true,
									rename: true,
									move_or_copy: true,
									language: Lang.get('current'),
									selectable: true,
									hideOnSelect: false,
									thumbSize: self.options.thumbSize,
									'onComplete': self.addMedia.bind(self),
									propagateData: {'uploadTokken': responseJSON.tokken},
									parentContainer: 'filemanagerWindow_contentWrapper',
									mkServerRequestURL: function(fm_obj, request_code, post_data)
									{
										return {
											url: fm_obj.options.url + '/' + request_code,
											data: post_data
										};
									}
								});

								// MUI Window creation
								var options = ION.getFilemanagerWindowOptions();
								
								options.content = filemanager.show();
								
								options.onResizeOnDrag = function()
								{
									filemanager.fitSizes();
								}
								
								self.window = new MUI.Window(options);
								self.window.filemanager = filemanager;
							}
							else
							{
								ION.notification('error', Lang.get('ionize_session_expired'));
							}
						}
					}, self).send();

					break;
				
				default : 
					ION.notification('error', 'No mode set for mediaManager');
			}
		}
	}
});

ION.append({

	/**
	 * Returns the Filemanager Mocha Window options
	 *
	 */
	getFilemanagerWindowOptions: function()
	{
		// Window size
		var wSize = {
			'width': 890,
			'height': 500,
			'x': 70,
			'y': null
		}
		
		// Get the size stored in the cookie, if any.
		if (Cookie.read('fm'))
		{
			var fm = new Hash.Cookie('fm', {duration: 365});
			
			wSize = {
				'width': fm.get('width'),
				'height': fm.get('height'),
				'y': fm.get('top'),
				'x': fm.get('left')
			}
		}

		var options  = 
		{
			id: 'filemanagerWindow',
			title: 'Filemanager',
			container: document.body,
			width: wSize.width,
			height: wSize.height,
			y: 35,
			padding: { top: 0, right: 0, bottom: 0, left: 0 },
			maximizable: false,
			contentBgColor: '#fff',
			onClose: function()
			{
				// Hides the filemanager
				this.filemanager.hide();
			}
/*			,
			onResize: function()
			{
				var fm = new Hash.Cookie('fm', {duration: 365});
				fm.erase();
				Object.append(fm, this.el.windowEl.getCoordinates());
			}
*/
		};
		
		return options;
	}
/*


	openFilemanager: function(callback)
	{
		var self = this;

		var xhr = new Request.JSON(
		{
			url: this.adminUrl + 'media/get_tokken',
			method: 'post',
			onSuccess: function(responseJSON, responseText)
			{
				// Open the filemanager if the tokken isn't empty
				if (responseJSON && responseJSON.tokken != '')
				{
				
					filemanager = new FileManager({
						baseURL: baseUrl,
						url: adminUrl + 'media/filemanager',
						assetBasePath: baseUrl + 'themes/admin/javascript/mootools-filemanager/Assets',
						language: Lang.get('current'),
						selectable: true,
						hideOnClick: true,
						onComplete: complete,
						'uploadAuthData': responseJSON.tokken
					});
				
					// Display the filemanager
					filemanager.show();
				}
				else
				{
					ION.notification('error', Lang.get('ionize_session_expired'));
				}
			}
		}, self).send();
	}
*/
});
