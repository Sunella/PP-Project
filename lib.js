var Scheduler = {
	DAYS: ['Mon','Tue','Wed','Thu','Fri','Sat', 'Sun'],
	MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'],
	LABELS: ['Breakfast', 'Lunch', 'Dinner', 'Outing', 'Tea'],
	Date: new Date(),
	UI: null,
	EVENTS: {},
	diary_open: false,
	
	init: function() {
		this.EVENTS = localStorage['events'];
		if(!this.EVENTS) {
			this.EVENTS = {};
			
			// first time
			if(!localStorage.setup) {
				var month = this.Date.getMonth(),
					year=this.Date.getFullYear();
				localStorage.setup = 1;
			}
		} else {
			try{
				this.EVENTS = JSON.parse(this.EVENTS);
			} catch(e) {
				localStorage.clear();
				this.EVENTS = {};
			}
		}

		this.phone = navigator.userAgent.match(/phone/i) || navigator.userAgent.match(/android/i);
		
		this.setDate();
		this.initUI();
		
		// what month to render first?
		var hash = document.location.href.match(/([0-9]{1,2})\-([0-9]{4})/i);
		if(hash && hash[1] >= 1 && hash[1] <= 12 && hash[2] >= 1900 && hash[2] <= 2050) {
			this.specificMonth(hash[1], hash[2]);
		} else {
			this.today();
		}
		
		// only load the diary on pageload if there's enough space to render it
		Scheduler.renderDiary( $('.day' + this.date).data('id') );
		this.UI.resize();

		Scheduler.UI.diary_wrap.show();
		var covered = (Scheduler.UI.diary_wrap.offset().left - Scheduler.UI.calendar_wrap.innerWidth());
		Scheduler.UI.diary_wrap.hide();
		if(!this.phone && covered > -35 && new Date().getMonth() == this.month ) {
			Scheduler.showDiary();
		}
	},
	initUI: function() {
		this.UI = {
			themes: ['light'],
			'calendar': $('#calendar'),
			'dialog': $('#dialog'),
			'add': $('#add'),
			'calendar_wrap': $('#calendar-wrap'),
			'diary_wrap': $('#diary-wrap'),
			'event_label': $('#event-label'),
			'event_hour': $('#event-hour'),
			'event_minute': $('#event-minute'),
			'event_description': $('#dName'),
			'event_delete': $('#event-delete'),
			'event_tweet': $('#event-tweet'),
			'diary': $('#diary')
		};
		
		// time in create event dialog
		var val = '';
		for(i=0; i<24; i++) {
			val = i.pad(2);
			this.UI.event_hour.append( $('<option value="'+val+'">').html(val) );
		}
		for(i=0; i<60; i+=15) {
			val = i.pad(2);
			val = val.substr(val.length-2);
			this.UI.event_minute.append( $('<option value="'+val+'">').html(val) );
		}
		
		// label colors in create event dialog
		var labels = $('<div class="labels">'), lbl = '';
		for(var i in this.LABELS) {
			lbl = this.LABELS[i];
			labels.append( $('<label class="'+lbl+' label" for="label-'+lbl+'">'+lbl+' <input type="radio" name="event-label" value="'+lbl+'" id="label-'+lbl+'" class="'+ lbl +'"></label>') );
		}
		this.UI.event_label.append(labels);
		
		// day names
		var html = '';
		for(var i=0; i<7; i++) {
			html += '<td>'+this.DAYS[i]+'</td>';
		}
		$('thead').append( $('<tr>').html(html) );
		
		// close add prompt
		$('#event-close').click(function() {
			Scheduler.closeAddPrompt();
		});
		$('#dialog-close').click(function() {
			Scheduler.closeDialog();
			return false;
		});
		$(document).keyup(function(e) {
			if(e.altKey) return;

			if (e.keyCode == 27) {
				Scheduler.closeAddPrompt();
			} else if (e.keyCode == 37) {
				Scheduler.previousMonth();
			} else if (e.keyCode == 39) {
				Scheduler.nextMonth();
			} else if (e.keyCode == 38 || e.keyCode == 40) {
				Scheduler.today();
			}
		});

		
		// event form add
		this.UI.add.submit(function() {
			Scheduler.createEvent(
				Scheduler.new_id,
				Scheduler.UI.event_hour.val(),
				Scheduler.UI.event_minute.val(),
				Scheduler.UI.event_description.val().replace(/<\/?(?!\!)[^>]*>/gi, ''),
				Scheduler.UI.event_label.find('input[name="event-label"]:checked').val(),
				Scheduler.event_i
			);
			Scheduler.closeAddPrompt();
			Scheduler.renderEvents();
			if(Scheduler.diary_open) {
				Scheduler.renderDiary(Scheduler.new_id);
			}
			return false;
		});
		
		this.UI.event_delete.click(function() {
			var id = $(this).data('id');
			Scheduler.deleteEvent( id, $(this).data('i') );
			Scheduler.closeDialog();
			Scheduler.renderCalendar();
			Scheduler.renderDiary(id);
			return false;
		});
		
		this.UI.event_tweet.click(function() {
			var id = $(this).data('id');
			var tweet = Scheduler.EVENTS[id][$(this).data('i')];
			
			window.open('http://twitter.com/home?status=' + escape(tweet.description + ' @ ' + tweet.hour + ':' + tweet.minute + ', ' + Scheduler.dateStringID(id)) );
			return false;
		});
		
		// previous and next buttons
		$('#btn-previous').click(function() {
			Scheduler.previousMonth();
			return false;
		});
		$('#btn-next').click(function() {
			Scheduler.nextMonth();
			return false;
		});
		$('#btn-today').click(function() {
			Scheduler.today();
			return false;
		});

		
		// diary close
		$('#diary-close').click(function() {
			this.diary_open = true;
			Scheduler.UI.diary_wrap.hide();
			return false;
		});

		this.updateTime();
		window.setInterval(function() {
			Scheduler.updateTime();
		}, 1000);

		this.UI.resize = function() {
			var wh = $(window).height(),
				ww = $(window).width(),
				ch = 0;
			var min = ( Math.min(ww, wh) );
			min = ( Math.max(min, 400) );
			
			ch = min/1.2;
			Scheduler.UI.calendar.width( ch );
			Scheduler.UI.calendar.height( ch );
			
			$('td').css('width', ch/7);

			Scheduler.UI.diary_wrap.height('auto');
			Scheduler.UI.calendar_wrap.height('auto');

			var box_height = Math.max(Scheduler.UI.calendar_wrap.outerHeight(), Scheduler.UI.diary_wrap.outerHeight(), wh);
			
			Scheduler.UI.calendar_wrap.height( box_height );
			Scheduler.UI.diary_wrap.height( box_height );

			Scheduler.UI.diary_wrap.width('auto');

			if( Scheduler.UI.calendar_wrap.outerWidth() + Scheduler.UI.diary_wrap.outerWidth() >  ww ) {
				$('body').addClass('compact');
			} else {
				$('body').removeClass('compact');
			}
		};
		$(window).resize(function() {
			Scheduler.UI.resize();
		});
	},
	renderCalendar: function() {
		document.location.href = '#' + ( this.month+1 + '-' + this.year );
		
		// rest of the days
		var wn = 0,
			tblweek = null,
			table = $('<tbody class="month'+this.month+'">');
						
		if(this.weekstart > 0) {
			tblweek = $('<tr>').addClass('w0');

			// blank days
			for(var i=0; i<this.weekstart; i++) {
				tblweek.append($('<td class="day">'));
			}
			table.append(tblweek);
			wn++;
		}

		for(var d=1; d <=this.num_days; d++) {
			var w = (this.weekstart+d-1)%7;
			if(w == 0) {	// new week
				tblweek = $('<tr>');
				table.append(tblweek);
				wn++;
			}

			var id = d+'-'+this.month+'-'+this.year;
			tblweek.append(
				$('<td valign="top" class="day">').addClass('day'+d).addClass('day'+id)
					.append( $('<div class="'+id+'">')
								.append( $('<span class="d">').html(d) )
								.append(
									$('<a href="#" title="add an event" class="round add">+</a>')
									.data('id', id)
									.click(function() {
										Scheduler.addPrompt($(this).data('id'));
										return false;
									})
								)
					).data('id', id).click(function() {
						Scheduler.renderDiary( $(this).data('id') );
						Scheduler.showDiary();
					})
			);
		}
		$('#calendar-title').html(this.MONTHS[this.month] + ' ' + this.year);
		$('tbody').replaceWith(table);

		// today
		$('.month' + new Date().getMonth() + ' .day' + this.date).addClass('today');
		$('.month' + this.month + ' .day' + this.date).addClass('marked');
		

		$('td.day').hover(function() {
			$(this).find('.add').stop().animate({opacity: 1}, 300);
		}, function() {
			$(this).find('.add').stop().animate({opacity: 0}, 200);
		});

		this.renderEvents();
	},
	renderEvents: function() {
		$('.d .events').remove();
		
		for(var id in this.EVENTS) {
			var ul = $('<ul>');
			$.each(this.EVENTS[id], function() {
				ul.append(
					$('<li class="label '+this.label+'">').append(
						$('<span class="time">' + this.hour + ':' + this.minute + '</span>')
					).append(
						$('<span class="desc">' + this.description + '</span>')
					)
				);
			});
			
			$('.'+id).append(ul);
		}
		
		var stats = this.stats();
		$('#stats').html( stats.future + ' upcoming events and ' + stats.past + ' past events' );
	},
	showDiary: function() {
		this.diary_open = true;
		this.UI.diary_wrap.show();
	},
	renderDiary: function(id) {
		$('#diary li').remove();
		$('#diary-title').html( this.dateStringID(id) );
		
		$('.day').removeClass('selected');
		$('.day'+id).addClass('selected');
		
		for(var i=0; i<24; i++) {
			var hour = ('0' + i);
			hour = hour.substr(hour.length-2);

			$('#diary').append(
				$('<li>').append(
					$('<a href="#" class="time">' + hour + ':00</a>').data({hour: hour, minute: '00'})
					.data('hour', hour)
					.click(function() {
						Scheduler.addPrompt(id, null, $(this).data('hour'), '00');
						return false;
					})
				).append('<div class="clear"> </div>')
				.addClass('hour'+hour)
			);
		}
		
		if(!this.EVENTS[id]) return;

		var removals={};
		$.each(this.EVENTS[id], function(i) {
			$('#diary .hour'+this.hour).after(
				$('<li>').append(
					$('<a href="#" class="time label '+this.label+'">' + this.hour + ':' + this.minute + '</a>')
					.click(function() {
						Scheduler.addPrompt(id, i);
						return false;
					})
				).append(
					$('<span class="desc">' + this.description + '&nbsp;</span>')
				).append('<div class="clear"> </div>')
			);
			if(parseInt(this.minute) === 0) {
				removals[this.hour] = true;
			}
		});

		// remove redundant hours
		for(var r in removals) {
			$('#diary .hour' + r).remove();
		}
	},
	dialog: function(target) {
		this.UI.dialog.find('.target').hide();
		target.show();
		
		// position
		this.UI.dialog.width( this.UI.calendar.width()/2 );
		this.UI.dialog.css('top', ( $(window).height() - this.UI.dialog.height())/2)
					.css('left', ( this.UI.calendar.width() - this.UI.dialog.width())/2);

		this.UI.dialog.show();
	},
	closeDialog: function() {
		this.UI.dialog.hide();
	},
	addPrompt: function(id, i, hour, minute) {
		this.new_id = id;
		this.event_i = null;

		this.UI.event_description.val('');
		this.UI.event_label.find('input:first').attr('checked', 'checked');
		
		this.UI.event_tweet.hide();
		this.UI.event_delete.hide();
		
		// passing an existing item
		if(id && i != null&& this.EVENTS[id][i]) {
			this.UI.event_description.val( this.EVENTS[id][i].description );
			this.UI.event_hour.val( this.EVENTS[id][i].hour );
			this.UI.event_minute.val( this.EVENTS[id][i].minute );
			this.UI.event_label.find('.' + this.EVENTS[id][i].label + ' input').attr('checked', 'checked');
		
			this.event_i = i;
			this.UI.event_delete.data({id: id, i: i}).show();
			this.UI.event_tweet.data({id: id, i: i}).show();
		} else if(hour && minute) {
			this.UI.event_hour.val( hour );
			this.UI.event_minute.val( minute );		
		}
		
		$('#event-date').html( this.dateStringID(id) );
		this.dialog( this.UI.add );
		this.UI.event_description.focus();
		
		return false;
	},
	closeAddPrompt: function() {
		this.closeDialog();
	},
	deleteEvent: function(id, i) {
		this.EVENTS[id].splice(i,1);
		
		if(this.EVENTS[id].length == 0) {
			delete this.EVENTS[id];
		}

		localStorage['events'] = JSON.stringify(this.EVENTS);
	},
	createEvent: function(id, hour, minute, description, label, i) {
		if(!this.EVENTS[id]) {
			this.EVENTS[id] = [];
		}

		var entry = {
				description: description,
				hour: hour,
				minute: minute,
				label: label
		};
		if(!i || i == null) {
			this.EVENTS[id].push(entry);
		} else {
			this.EVENTS[id][i] = entry;
		}
		
		this.EVENTS[id].sort(function(a, b) {
			return parseInt(a.hour+''+a.minute) -  parseInt(b.hour+''+b.minute);
		});
		
		localStorage['events'] = JSON.stringify(this.EVENTS);
	},
	
	
	today: function() {
		this.Date = new Date();
		this.setDate();
		this.renderCalendar();
	},
	nextMonth: function() {
		this.Date.setMonth(this.month+1);
		this.setDate();
		this.renderCalendar();
	},
	previousMonth: function() {
		this.Date.setMonth(this.Month-1 < 0 ? 11 : this.month-1);
		this.setDate();
		this.renderCalendar();
	},
	specificMonth: function(m, y) {
		this.Date.setMonth(m-1);
		this.Date.setYear(y);
		this.setDate();
		this.renderCalendar();	
	},
	
	weekDay: function(d) {
		return (d-1).mod(7);
	},
	setDate: function() {
		this.day = this.Date.getDay();
		this.weekstart = new Date(this.Date.getTime());
		this.weekstart.setDate(1);
		this.weekstart = this.weekDay( this.weekstart.getDay() );

		this.date = this.Date.getDate();
		this.month = this.Date.getMonth();
		this.year = this.Date.getFullYear();
		
		this.num_days = 32 - new Date(this.year, this.month, 32).getDate();
	},
	dateStringID: function(id) {
		var date = this.dateFromID(id),
			d = date.getDate()
		
		d+=(d>10 && d<20 ? 'th' : {1:'st', 2:'nd', 3:'rd'}[d % 10] || 'th');
		
		return this.DAYS[ this.weekDay( date.getDay() ) ] + ', ' +
				d + ' ' + this.MONTHS[date.getMonth()] + ', ' + date.getFullYear();
	},
	dateFromID: function(id) {
		id = id.split('-');
		return new Date(id[2], id[1], id[0]);
	},
	updateTime: function() {
		var time = new Date();
		$('#time').html( time.getHours().pad(2) + ':' + time.getMinutes().pad(2) );
	},
	stats: function() {
		var stats = {past: 0, future: 0};

		var today = new Date();
		for(var id in this.EVENTS) {
			var date = Scheduler.dateFromID(id);

			if(date.getTime() > today.getTime()) {
				stats.future+= this.EVENTS[id].length;
			} else {
				stats.past+= this.EVENTS[id].length;
			}
		}
		
		return stats;
	},
	theme: function(theme) {
		$('body').removeClass(Scheduler.UI.themes.join(' ')).addClass( Scheduler.UI.themes[theme] );
	}
};

Number.prototype.mod = function(n) {
	return ((this%n)+n)%n;
};
Number.prototype.pad = function(n) {
	var val = '0' + this;
	return val.substr(val.length-n);
};

$(document).ready(function() {
	Scheduler.init();
});