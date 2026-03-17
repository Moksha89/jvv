
// ============================================================
// India Directory API - States, Districts, Mandals, Villages
// ============================================================

const INDIA_DIRECTORY = {
'andhra-pradesh': {
    name:'Andhra Pradesh',capital:'Amaravati',emoji:'\ud83c\udf34',pop:'5.27 Cr',population:'5,27,00,000',area:'1,60,205 km\u00b2',lang:'Telugu',language:'Telugu',literacy:'67.41%',established:'1956 (Reorganized 2014)',zones:'South',color:'#059669',
    famousPlaces:[
        {name:'Tirumala Tirupati Temple',icon:'\ud83d\uded5',description:'One of the most visited religious sites in the world. Lord Venkateswara temple atop the seven hills.',location:true},
        {name:'Araku Valley',icon:'\u26f0\ufe0f',description:'Hill station known for coffee plantations, tribal culture and scenic beauty.',location:true},
        {name:'Visakhapatnam (Vizag)',icon:'\ud83c\udfd6\ufe0f',description:'Port city with beautiful beaches - RK Beach, Rushikonda. Home to Eastern Naval Command.',location:true},
        {name:'Srisailam Temple',icon:'\ud83d\uded5',description:'Jyotirlinga temple dedicated to Lord Shiva, located in Nallamala Hills.',location:true},
        {name:'Lepakshi',icon:'\ud83c\udfdb\ufe0f',description:'Famous for the hanging pillar at Veerabhadra Temple and Nandi statue.',location:true}
    ],
    connectivity:{airports:'Visakhapatnam, Vijayawada, Tirupati, Rajahmundry',railways:'Vijayawada Junction, Visakhapatnam, Tirupati, Guntur',highways:'NH-16, NH-44, NH-65, NH-40',ports:'Visakhapatnam Port, Krishnapatnam Port, Gangavaram Port'},
    govOffices:[
        {type:'Government Office',name:'AP Secretariat',address:'Velagapudi, Amaravati',phone:'0866-2462636',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'Andhra Medical College & King George Hospital',address:'Maharanipeta, Visakhapatnam',phone:'0891-2564891',timing:'24/7'},
        {type:'Police Station',name:'AP Police Headquarters',address:'Mangalagiri, Guntur',phone:'0863-2234050',timing:'24/7'},
        {type:'Court',name:'AP High Court',address:'Nelapadu, Amaravati',phone:'0863-2345678',timing:'10:00 AM - 4:30 PM'}
    ],
    districts:[
        {id:'anantapur',name:'Anantapur',hq:'Anantapur',population:'40.8 L',famous:'Lepakshi Temple, Penukonda Fort, Gooty Fort'},
        {id:'chittoor',name:'Chittoor',hq:'Chittoor',population:'41.7 L',famous:'Tirupati Temple, Horsley Hills, Talakona Waterfall'},
        {id:'east-godavari',name:'East Godavari',hq:'Kakinada',population:'51.5 L',famous:'Papikondalu, Draksharamam, Coringa Wildlife'},
        {id:'guntur',name:'Guntur',hq:'Guntur',population:'48.9 L',famous:'Amaravati Buddhist Site, Undavalli Caves, Kondaveedu Fort'},
        {id:'krishna',name:'Krishna',hq:'Machilipatnam',population:'45.3 L',famous:'Vijayawada, Kanaka Durga Temple, Prakasam Barrage'},
        {id:'kurnool',name:'Kurnool',hq:'Kurnool',population:'40.5 L',famous:'Belum Caves, Srisailam Dam, Ahobilam Temple'},
        {id:'nellore',name:'Nellore (Sri Potti Sriramulu)',hq:'Nellore',population:'29.7 L',famous:'Pulicat Lake, Mypadu Beach, Penchalakona'},
        {id:'prakasam',name:'Prakasam',hq:'Ongole',population:'34.0 L',famous:'Ongole cattle breed, Vodarevu Beach, Cumbum Lake'},
        {id:'srikakulam',name:'Srikakulam',hq:'Srikakulam',population:'27.0 L',famous:'Arasavilli Sun Temple, Srikurmam Temple'},
        {id:'visakhapatnam',name:'Visakhapatnam',hq:'Visakhapatnam',population:'42.9 L',famous:'RK Beach, Kailasagiri, Borra Caves, Araku Valley'},
        {id:'vizianagaram',name:'Vizianagaram',hq:'Vizianagaram',population:'23.4 L',famous:'Vizianagaram Fort, Ramanarayanam Temple'},
        {id:'west-godavari',name:'West Godavari',hq:'Eluru',population:'39.3 L',famous:'Kolleru Lake, Eluru, Dwaraka Tirumala Temple'},
        {id:'ysr-kadapa',name:'YSR Kadapa',hq:'Kadapa',population:'28.8 L',famous:'Ameen Peer Dargah, Gandikota Grand Canyon'}
    ]
},
'telangana': {
    name:'Telangana',capital:'Hyderabad',emoji:'\ud83d\udc8e',pop:'3.94 Cr',population:'3,94,00,000',area:'1,12,077 km\u00b2',lang:'Telugu, Urdu',language:'Telugu, Urdu',literacy:'66.54%',established:'2014',zones:'South',color:'#7c3aed',
    famousPlaces:[
        {name:'Charminar',icon:'\ud83d\udd4c',description:'Iconic monument built in 1591, symbol of Hyderabad. Located in the old city area.',location:true},
        {name:'Golconda Fort',icon:'\ud83c\udff0',description:'Historic fort known for its acoustic architecture and diamond mining history.',location:true},
        {name:'Ramoji Film City',icon:'\ud83c\udfa5',description:"World's largest film studio complex spread over 1,666 acres.",location:true},
        {name:'Hussain Sagar Lake',icon:'\ud83c\udfd6\ufe0f',description:'Heart-shaped artificial lake with 18m tall Buddha statue in the center.',location:true}
    ],
    connectivity:{airports:'Rajiv Gandhi International Airport (Hyderabad)',railways:'Secunderabad Junction, Hyderabad Deccan, Kacheguda',highways:'NH-44, NH-65, NH-163, NH-765',ports:'Inland Container Depot, Sanathnagar'},
    govOffices:[
        {type:'Government Office',name:'Telangana Secretariat',address:'Secretariat Road, Hyderabad',phone:'040-23452685',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'Osmania General Hospital',address:'Afzalgunj, Hyderabad',phone:'040-24600146',timing:'24/7'},
        {type:'Police Station',name:'Telangana Police HQ',address:'Lakdikapul, Hyderabad',phone:'040-23242000',timing:'24/7'}
    ],
    districts:[
        {id:'hyderabad',name:'Hyderabad',hq:'Hyderabad',population:'68.1 L',famous:'Charminar, Golconda Fort, Hussain Sagar'},
        {id:'rangareddy',name:'Rangareddy',hq:'Shamshabad',population:'52.9 L',famous:'Shamshabad Airport area, Gandipet Lake'},
        {id:'medchal-malkajgiri',name:'Medchal-Malkajgiri',hq:'Medchal',population:'28.2 L',famous:'IT corridor, Kompally, Medchal'},
        {id:'warangal-urban',name:'Warangal Urban',hq:'Warangal',population:'11.0 L',famous:'Warangal Fort, Thousand Pillar Temple, Bhadrakali Temple'},
        {id:'karimnagar',name:'Karimnagar',hq:'Karimnagar',population:'10.1 L',famous:'Elgandal Fort, Lower Manair Dam'},
        {id:'nizamabad',name:'Nizamabad',hq:'Nizamabad',population:'15.4 L',famous:'Nizamabad Fort, Ashok Sagar, Kanteshwar Temple'},
        {id:'khammam',name:'Khammam',hq:'Khammam',population:'14.0 L',famous:'Khammam Fort, Kinnerasani Wildlife Sanctuary'},
        {id:'nalgonda',name:'Nalgonda',hq:'Nalgonda',population:'16.3 L',famous:'Nagarjuna Sagar Dam, Ethipothala Falls'},
        {id:'mahbubnagar',name:'Mahbubnagar',hq:'Mahbubnagar',population:'14.3 L',famous:'Pillalamarri Banyan Tree, Koilkonda Fort'},
        {id:'adilabad',name:'Adilabad',hq:'Adilabad',population:'7.1 L',famous:'Kuntala Waterfall, Basar Saraswati Temple'}
    ]
},
'tamil-nadu': {
    name:'Tamil Nadu',capital:'Chennai',emoji:'\ud83d\uded5',pop:'7.71 Cr',population:'7,71,00,000',area:'1,30,058 km\u00b2',lang:'Tamil',language:'Tamil',literacy:'80.33%',established:'1956',zones:'South',color:'#dc2626',
    famousPlaces:[
        {name:'Meenakshi Amman Temple',icon:'\ud83d\uded5',description:'Ancient temple in Madurai with stunning Dravidian architecture and 14 gopurams.',location:true},
        {name:'Marina Beach',icon:'\ud83c\udfd6\ufe0f',description:"World's second longest urban beach at 13 km. Major landmark of Chennai.",location:true},
        {name:'Ooty (Udhagamandalam)',icon:'\u26f0\ufe0f',description:'Queen of Hill Stations in Nilgiri Hills. Famous for tea gardens and toy train.',location:true},
        {name:'Rameswaram',icon:'\ud83d\uded5',description:'One of the four Char Dham pilgrimage sites. Pamban Bridge is an engineering marvel.',location:true},
        {name:'Kodaikanal',icon:'\ud83c\udfd4\ufe0f',description:'Princess of Hill Stations. Known for Kodai Lake, Pillar Rocks, and Bryant Park.',location:true}
    ],
    connectivity:{airports:'Chennai International, Madurai, Tiruchirappalli, Coimbatore, Salem',railways:'Chennai Central, Madurai Junction, Coimbatore Junction, Tiruchirappalli Junction',highways:'NH-44, NH-48, NH-45, NH-47',ports:'Chennai Port, V.O. Chidambaranar Port (Tuticorin), Ennore Port'},
    govOffices:[
        {type:'Government Office',name:'TN Secretariat (Fort St. George)',address:'Fort St. George, Chennai',phone:'044-25671011',timing:'10:00 AM - 5:45 PM'},
        {type:'Hospital',name:'Government General Hospital',address:'Park Town, Chennai',phone:'044-25305000',timing:'24/7'},
        {type:'Police Station',name:'TN Police Headquarters',address:'Mylapore, Chennai',phone:'044-28447777',timing:'24/7'}
    ],
    districts:[
        {id:'chennai',name:'Chennai',hq:'Chennai',population:'46.8 L',famous:'Marina Beach, Fort St. George, Kapaleeshwarar Temple'},
        {id:'coimbatore',name:'Coimbatore',hq:'Coimbatore',population:'34.6 L',famous:'Marudhamalai Temple, VOC Park, textile hub'},
        {id:'madurai',name:'Madurai',hq:'Madurai',population:'30.4 L',famous:'Meenakshi Temple, Thirumalai Nayakkar Mahal'},
        {id:'tiruchirappalli',name:'Tiruchirappalli',hq:'Tiruchirappalli',population:'27.2 L',famous:'Rock Fort, Srirangam Temple, BHEL'},
        {id:'salem',name:'Salem',hq:'Salem',population:'34.8 L',famous:'Yercaud Hill Station, Mettur Dam, Steel Plant'},
        {id:'tirunelveli',name:'Tirunelveli',hq:'Tirunelveli',population:'30.8 L',famous:'Courtallam Falls, Nellaiappar Temple'},
        {id:'erode',name:'Erode',hq:'Erode',population:'22.5 L',famous:'Bhavani Sangameshwarar Temple, Textile Hub'},
        {id:'thanjavur',name:'Thanjavur',hq:'Thanjavur',population:'24.0 L',famous:'Brihadeeswarar Temple (UNESCO), Rice Bowl of TN'},
        {id:'kancheepuram',name:'Kancheepuram',hq:'Kancheepuram',population:'39.9 L',famous:'Silk sarees, ancient temples, Mahabalipuram'},
        {id:'tiruppur',name:'Tiruppur',hq:'Tiruppur',population:'24.8 L',famous:'Knitwear capital of India, textile exports'}
    ]
},
'karnataka': {
    name:'Karnataka',capital:'Bengaluru',emoji:'\ud83c\udf3a',pop:'6.79 Cr',population:'6,79,00,000',area:'1,91,791 km\u00b2',lang:'Kannada',language:'Kannada',literacy:'75.36%',established:'1956',zones:'South',color:'#dc2626',
    famousPlaces:[
        {name:'Hampi',icon:'\ud83c\udfdb\ufe0f',description:'UNESCO World Heritage Site. Ruins of the Vijayanagara Empire capital.',location:true},
        {name:'Mysore Palace',icon:'\ud83c\udff0',description:'Grand royal palace of the Wadiyar dynasty. Spectacular during Dasara illumination.',location:true},
        {name:'Coorg (Kodagu)',icon:'\u2615',description:'Scotland of India. Famous for coffee plantations, Abbey Falls, and Raja Seat.',location:true},
        {name:'Jog Falls',icon:'\ud83c\udf0a',description:'Second highest plunge waterfall in India at 253 meters.',location:true}
    ],
    connectivity:{airports:'Kempegowda International (Bengaluru), Mangalore, Hubli, Mysore',railways:'Bengaluru City, Mysore, Hubli, Mangalore Central',highways:'NH-44, NH-48, NH-75, NH-66',ports:'New Mangalore Port'},
    govOffices:[
        {type:'Government Office',name:'Vidhana Soudha',address:'Dr. Ambedkar Veedhi, Bengaluru',phone:'080-22253414',timing:'10:00 AM - 5:30 PM'},
        {type:'Hospital',name:'Victoria Hospital',address:'Fort, Bengaluru',phone:'080-26701150',timing:'24/7'},
        {type:'Police Station',name:'Karnataka Police HQ',address:'Nrupatunga Road, Bengaluru',phone:'080-22212747',timing:'24/7'}
    ],
    districts:[
        {id:'bengaluru-urban',name:'Bengaluru Urban',hq:'Bengaluru',population:'96.2 L',famous:'IT Hub, Lalbagh, Cubbon Park, Vidhana Soudha'},
        {id:'mysuru',name:'Mysuru',hq:'Mysuru',population:'30.0 L',famous:'Mysore Palace, Chamundi Hills, Brindavan Gardens'},
        {id:'belagavi',name:'Belagavi',hq:'Belagavi',population:'48.8 L',famous:'Gokak Falls, Belgaum Fort, Military Cantonment'},
        {id:'dakshina-kannada',name:'Dakshina Kannada',hq:'Mangaluru',population:'20.8 L',famous:'Mangalore beaches, Dharmasthala, St. Aloysius Chapel'},
        {id:'hassan',name:'Hassan',hq:'Hassan',population:'17.8 L',famous:'Belur-Halebidu Temples, Shravanabelagola'},
        {id:'tumkur',name:'Tumkur',hq:'Tumkur',population:'26.8 L',famous:'Siddaganga Mutt, Devarayanadurga Hills'},
        {id:'ballari',name:'Ballari',hq:'Ballari',population:'25.3 L',famous:'Hampi, Iron ore mining hub'},
        {id:'dharwad',name:'Dharwad',hq:'Dharwad',population:'18.5 L',famous:'Dharwad Peda, University town, Unkal Lake'}
    ]
},
'maharashtra': {
    name:'Maharashtra',capital:'Mumbai',emoji:'\ud83c\udfd9\ufe0f',pop:'12.47 Cr',population:'12,47,00,000',area:'3,07,713 km\u00b2',lang:'Marathi',language:'Marathi',literacy:'82.34%',established:'1960',zones:'West',color:'#1e40af',
    famousPlaces:[
        {name:'Gateway of India',icon:'\ud83c\udfdb\ufe0f',description:'Iconic arch monument on Mumbai waterfront, built in 1924.',location:true},
        {name:'Ajanta & Ellora Caves',icon:'\ud83d\uded5',description:'UNESCO World Heritage Sites with rock-cut Buddhist, Hindu and Jain caves.',location:true},
        {name:'Shirdi Sai Baba Temple',icon:'\ud83d\uded5',description:'One of the most visited pilgrimage centers in India.',location:true},
        {name:'Lonavala-Khandala',icon:'\u26f0\ufe0f',description:'Twin hill stations near Mumbai/Pune, famous for chikki and monsoon views.',location:true}
    ],
    connectivity:{airports:'Mumbai (CSIA), Pune, Nagpur, Aurangabad, Nashik, Kolhapur',railways:'Mumbai CSMT, Pune, Nagpur, Nashik Road, Solapur',highways:'NH-48, NH-44, NH-66, Mumbai-Pune Expressway',ports:'Mumbai Port, Jawaharlal Nehru Port (Navi Mumbai)'},
    govOffices:[
        {type:'Government Office',name:'Mantralaya (MH Secretariat)',address:'Nariman Point, Mumbai',phone:'022-22024068',timing:'10:00 AM - 5:45 PM'},
        {type:'Hospital',name:'KEM Hospital',address:'Parel, Mumbai',phone:'022-24136051',timing:'24/7'},
        {type:'Police Station',name:'Maharashtra Police HQ',address:'Colaba, Mumbai',phone:'022-22621855',timing:'24/7'}
    ],
    districts:[
        {id:'mumbai',name:'Mumbai City',hq:'Mumbai',population:'30.9 L',famous:'Gateway of India, Marine Drive, Bollywood'},
        {id:'mumbai-suburban',name:'Mumbai Suburban',hq:'Bandra',population:'93.6 L',famous:'Bandra-Worli Sea Link, Film City, Juhu Beach'},
        {id:'pune',name:'Pune',hq:'Pune',population:'94.3 L',famous:'Shaniwar Wada, Aga Khan Palace, IT Hub'},
        {id:'nagpur',name:'Nagpur',hq:'Nagpur',population:'46.5 L',famous:'Deekshabhoomi, Zero Mile, Orange City'},
        {id:'nashik',name:'Nashik',hq:'Nashik',population:'61.1 L',famous:'Trimbakeshwar, Kumbh Mela, Wine Capital'},
        {id:'thane',name:'Thane',hq:'Thane',population:'110.6 L',famous:'Sanjay Gandhi National Park, Upvan Lake'},
        {id:'aurangabad',name:'Chhatrapati Sambhajinagar',hq:'Aurangabad',population:'37.0 L',famous:'Ajanta-Ellora Caves, Bibi Ka Maqbara'},
        {id:'solapur',name:'Solapur',hq:'Solapur',population:'43.2 L',famous:'Pandharpur Vitthal Temple, Textile Hub'},
        {id:'kolhapur',name:'Kolhapur',hq:'Kolhapur',population:'38.7 L',famous:'Mahalaxmi Temple, Kolhapuri Chappal, Rankala Lake'},
        {id:'ratnagiri',name:'Ratnagiri',hq:'Ratnagiri',population:'16.1 L',famous:'Alphonso Mangoes, Ganpatipule, Jaigad Fort'}
    ]
},
'uttar-pradesh': {
    name:'Uttar Pradesh',capital:'Lucknow',emoji:'\ud83d\udd4c',pop:'23.15 Cr',population:'23,15,00,000',area:'2,40,928 km\u00b2',lang:'Hindi, Urdu',language:'Hindi, Urdu',literacy:'67.68%',established:'1950',zones:'North',color:'#1e40af',
    famousPlaces:[
        {name:'Taj Mahal',icon:'\ud83d\udd4c',description:'UNESCO World Heritage Site. One of the Seven Wonders of the World, built by Shah Jahan.',location:true},
        {name:'Varanasi Ghats',icon:'\ud83d\uded5',description:'One of the oldest living cities in the world. Sacred ghats along river Ganga.',location:true},
        {name:'Ayodhya Ram Mandir',icon:'\ud83d\uded5',description:'Newly built grand temple at the birthplace of Lord Ram.',location:true},
        {name:'Mathura-Vrindavan',icon:'\ud83d\uded5',description:'Birthplace of Lord Krishna. Famous for Holi celebrations and temples.',location:true}
    ],
    connectivity:{airports:'Lucknow, Varanasi, Agra, Prayagraj, Gorakhpur, Kanpur',railways:'Lucknow Junction, Varanasi Junction, Agra Cantt, Kanpur Central',highways:'NH-44, NH-2, NH-24, NH-28, Yamuna Expressway, Agra-Lucknow Expressway'},
    govOffices:[
        {type:'Government Office',name:'UP Secretariat (Lok Bhawan)',address:'Vidhan Sabha Marg, Lucknow',phone:'0522-2239261',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'King George Medical University',address:'Shah Mina Road, Lucknow',phone:'0522-2257540',timing:'24/7'},
        {type:'Police Station',name:'UP Police HQ',address:'Gomti Nagar, Lucknow',phone:'0522-2620373',timing:'24/7'}
    ],
    districts:[
        {id:'lucknow',name:'Lucknow',hq:'Lucknow',population:'45.9 L',famous:'Bara Imambara, Rumi Darwaza, Hazratganj'},
        {id:'agra',name:'Agra',hq:'Agra',population:'44.2 L',famous:'Taj Mahal, Agra Fort, Fatehpur Sikri'},
        {id:'varanasi',name:'Varanasi',hq:'Varanasi',population:'36.8 L',famous:'Kashi Vishwanath, Ghats, BHU'},
        {id:'kanpur',name:'Kanpur Nagar',hq:'Kanpur',population:'45.8 L',famous:'Industrial hub, IIT Kanpur, Allen Forest Zoo'},
        {id:'prayagraj',name:'Prayagraj',hq:'Prayagraj',population:'59.5 L',famous:'Triveni Sangam, Kumbh Mela, Anand Bhawan'},
        {id:'gorakhpur',name:'Gorakhpur',hq:'Gorakhpur',population:'44.4 L',famous:'Gorakhnath Temple, longest railway platform'},
        {id:'meerut',name:'Meerut',hq:'Meerut',population:'34.4 L',famous:'Sports goods hub, 1857 revolt origin'},
        {id:'noida',name:'Gautam Buddh Nagar',hq:'Noida',population:'16.5 L',famous:'Noida IT Hub, Film City, Formula 1 track'},
        {id:'mathura',name:'Mathura',hq:'Mathura',population:'25.4 L',famous:'Krishna Janmabhoomi, Vrindavan temples'},
        {id:'ayodhya',name:'Ayodhya (Faizabad)',hq:'Ayodhya',population:'24.7 L',famous:'Ram Mandir, Saryu River, Hanuman Garhi'}
    ]
},
'rajasthan': {
    name:'Rajasthan',capital:'Jaipur',emoji:'\ud83c\udfdc\ufe0f',pop:'8.07 Cr',population:'8,07,00,000',area:'3,42,239 km\u00b2',lang:'Hindi, Rajasthani',language:'Hindi, Rajasthani',literacy:'66.11%',established:'1949',zones:'West',color:'#d97706',
    famousPlaces:[
        {name:'Amber Fort, Jaipur',icon:'\ud83c\udff0',description:'Majestic fort overlooking Maota Lake. Famous for Sheesh Mahal (Mirror Palace).',location:true},
        {name:'City Palace, Udaipur',icon:'\ud83c\udff0',description:'Grand palace complex on the banks of Lake Pichola. Rajasthan most romantic city.',location:true},
        {name:'Jaisalmer Fort',icon:'\ud83c\udff0',description:'Living fort in the Thar Desert. One of the largest fully preserved forts in the world.',location:true},
        {name:'Pushkar Lake',icon:'\ud83d\uded5',description:'Sacred lake with 52 bathing ghats. Famous for annual Pushkar Camel Fair.',location:true}
    ],
    connectivity:{airports:'Jaipur, Udaipur, Jodhpur, Jaisalmer, Ajmer/Kishangarh',railways:'Jaipur Junction, Jodhpur Junction, Udaipur City, Ajmer Junction',highways:'NH-48, NH-8, NH-11, NH-15'},
    govOffices:[
        {type:'Government Office',name:'Rajasthan Secretariat',address:'Secretariat Road, Jaipur',phone:'0141-2227614',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'SMS Hospital',address:'JLN Marg, Jaipur',phone:'0141-2518265',timing:'24/7'},
        {type:'Police Station',name:'Rajasthan Police HQ',address:'Lal Kothi, Jaipur',phone:'0141-2742484',timing:'24/7'}
    ],
    districts:[
        {id:'jaipur',name:'Jaipur',hq:'Jaipur',population:'66.6 L',famous:'Hawa Mahal, Amber Fort, City Palace, Pink City'},
        {id:'jodhpur',name:'Jodhpur',hq:'Jodhpur',population:'36.9 L',famous:'Mehrangarh Fort, Blue City, Umaid Bhawan Palace'},
        {id:'udaipur',name:'Udaipur',hq:'Udaipur',population:'30.7 L',famous:'City of Lakes, Lake Palace, Fateh Sagar'},
        {id:'jaisalmer',name:'Jaisalmer',hq:'Jaisalmer',population:'6.7 L',famous:'Golden City, Sam Sand Dunes, Jaisalmer Fort'},
        {id:'ajmer',name:'Ajmer',hq:'Ajmer',population:'25.8 L',famous:'Ajmer Sharif Dargah, Pushkar, Ana Sagar Lake'},
        {id:'bikaner',name:'Bikaner',hq:'Bikaner',population:'23.6 L',famous:'Junagarh Fort, Karni Mata Temple (Rat Temple)'},
        {id:'kota',name:'Kota',hq:'Kota',population:'19.5 L',famous:'Coaching hub of India, Chambal Gardens'},
        {id:'alwar',name:'Alwar',hq:'Alwar',population:'36.7 L',famous:'Sariska Tiger Reserve, Bala Quila, Siliserh Lake'}
    ]
},
'kerala': {
    name:'Kerala',capital:'Thiruvananthapuram',emoji:'\ud83c\udf34',pop:'3.56 Cr',population:'3,56,00,000',area:'38,863 km\u00b2',lang:'Malayalam',language:'Malayalam',literacy:'93.91%',established:'1956',zones:'South',color:'#059669',
    famousPlaces:[
        {name:'Alleppey Backwaters',icon:'\u26f5',description:'Venice of the East. Famous for houseboat cruises through serene backwaters.',location:true},
        {name:'Munnar',icon:'\u26f0\ufe0f',description:'Hill station with vast tea plantations, Eravikulam National Park, Mattupetty Dam.',location:true},
        {name:'Wayanad',icon:'\ud83c\udf3f',description:'Green paradise with Edakkal Caves, Chembra Peak, Banasura Sagar Dam.',location:true},
        {name:'Kovalam Beach',icon:'\ud83c\udfd6\ufe0f',description:'Crescent-shaped beach famous for its lighthouse and Ayurvedic resorts.',location:true}
    ],
    connectivity:{airports:'Cochin International, Trivandrum, Calicut',railways:'Thiruvananthapuram Central, Ernakulam, Kozhikode, Thrissur',highways:'NH-66, NH-544, NH-85',ports:'Cochin Port (major), Vizhinjam International Port'},
    govOffices:[
        {type:'Government Office',name:'Kerala Secretariat',address:'Secretariat, Thiruvananthapuram',phone:'0471-2333812',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'Medical College Thiruvananthapuram',address:'Chalakkuzhi, Thiruvananthapuram',phone:'0471-2528386',timing:'24/7'}
    ],
    districts:[
        {id:'thiruvananthapuram',name:'Thiruvananthapuram',hq:'Thiruvananthapuram',population:'33.1 L',famous:'Padmanabhaswamy Temple, Kovalam, Technopark'},
        {id:'ernakulam',name:'Ernakulam',hq:'Kochi',population:'32.8 L',famous:'Fort Kochi, Marine Drive, Lulu Mall'},
        {id:'kozhikode',name:'Kozhikode',hq:'Kozhikode',population:'30.9 L',famous:'Kappad Beach, Kozhikode Halwa, SM Street'},
        {id:'thrissur',name:'Thrissur',hq:'Thrissur',population:'31.2 L',famous:'Pooram Festival, Vadakkunnathan Temple'},
        {id:'alappuzha',name:'Alappuzha',hq:'Alappuzha',population:'21.3 L',famous:'Backwaters, Houseboats, Snake Boat Race'},
        {id:'kollam',name:'Kollam',hq:'Kollam',population:'26.3 L',famous:'Ashtamudi Lake, Cashew Capital'},
        {id:'idukki',name:'Idukki',hq:'Painavu',population:'11.1 L',famous:'Idukki Arch Dam, Munnar, Spice Gardens'},
        {id:'wayanad',name:'Wayanad',hq:'Kalpetta',population:'8.2 L',famous:'Edakkal Caves, Chembra Peak, Wildlife'}
    ]
},
'west-bengal': {
    name:'West Bengal',capital:'Kolkata',emoji:'\ud83d\udc2f',pop:'10.09 Cr',population:'10,09,00,000',area:'88,752 km\u00b2',lang:'Bengali',language:'Bengali',literacy:'76.26%',established:'1950',zones:'East',color:'#dc2626',
    famousPlaces:[
        {name:'Victoria Memorial',icon:'\ud83c\udfdb\ufe0f',description:'Magnificent marble building and museum dedicated to Queen Victoria.',location:true},
        {name:'Darjeeling',icon:'\u2615',description:'Queen of Hills. Famous for tea gardens, Toy Train (UNESCO), and Kanchenjunga views.',location:true},
        {name:'Sundarbans',icon:'\ud83d\udc2f',description:'UNESCO World Heritage Site. Largest mangrove forest and home to Royal Bengal Tigers.',location:true},
        {name:'Howrah Bridge',icon:'\ud83c\udf09',description:'Iconic cantilever bridge over Hooghly River, one of the busiest bridges in the world.',location:true}
    ],
    connectivity:{airports:'Netaji Subhas Chandra Bose International (Kolkata), Bagdogra',railways:'Howrah Junction, Sealdah, New Jalpaiguri',highways:'NH-34, NH-2, NH-6',ports:'Kolkata Port, Haldia Port'},
    govOffices:[
        {type:'Government Office',name:'Writers Building (WB Secretariat)',address:'BBD Bagh, Kolkata',phone:'033-22145555',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'SSKM Hospital',address:'AJC Bose Road, Kolkata',phone:'033-22041101',timing:'24/7'}
    ],
    districts:[
        {id:'kolkata',name:'Kolkata',hq:'Kolkata',population:'44.9 L',famous:'Victoria Memorial, Howrah Bridge, Park Street'},
        {id:'north-24-parganas',name:'North 24 Parganas',hq:'Barasat',population:'100.1 L',famous:'Dakshineswar Temple, Barrackpore'},
        {id:'south-24-parganas',name:'South 24 Parganas',hq:'Alipore',population:'81.5 L',famous:'Sundarbans, Diamond Harbour'},
        {id:'darjeeling',name:'Darjeeling',hq:'Darjeeling',population:'18.5 L',famous:'Tea Gardens, Toy Train, Tiger Hill'},
        {id:'howrah',name:'Howrah',hq:'Howrah',population:'48.5 L',famous:'Howrah Bridge, Botanical Garden, Belur Math'},
        {id:'murshidabad',name:'Murshidabad',hq:'Baharampur',population:'71.0 L',famous:'Hazarduari Palace, Murshidabad Silk'}
    ]
},
'gujarat': {
    name:'Gujarat',capital:'Gandhinagar',emoji:'\ud83e\udd81',pop:'7.07 Cr',population:'7,07,00,000',area:'1,96,024 km\u00b2',lang:'Gujarati',language:'Gujarati',literacy:'78.03%',established:'1960',zones:'West',color:'#ea580c',
    famousPlaces:[
        {name:'Statue of Unity',icon:'\ud83d\uddff',description:"World's tallest statue (182m) of Sardar Vallabhbhai Patel at Kevadiya.",location:true},
        {name:'Gir National Park',icon:'\ud83e\udd81',description:'Only home of Asiatic Lions in the world.',location:true},
        {name:'Rann of Kutch',icon:'\ud83c\udfdc\ufe0f',description:'White salt desert that comes alive during the Rann Utsav festival.',location:true},
        {name:'Somnath Temple',icon:'\ud83d\uded5',description:'First among the twelve Jyotirlinga shrines of Lord Shiva.',location:true}
    ],
    connectivity:{airports:'Ahmedabad, Vadodara, Surat, Rajkot, Bhavnagar',railways:'Ahmedabad Junction, Surat, Vadodara, Rajkot',highways:'NH-48, NH-8, NH-8A',ports:'Kandla Port, Mundra Port, Dahej Port'},
    govOffices:[
        {type:'Government Office',name:'Gujarat Secretariat (Sachivalaya)',address:'Gandhinagar',phone:'079-23250400',timing:'10:30 AM - 6:10 PM'},
        {type:'Hospital',name:'Civil Hospital Ahmedabad',address:'Asarwa, Ahmedabad',phone:'079-22683721',timing:'24/7'}
    ],
    districts:[
        {id:'ahmedabad',name:'Ahmedabad',hq:'Ahmedabad',population:'72.1 L',famous:'Sabarmati Ashram, Adalaj Stepwell, Kankaria Lake'},
        {id:'surat',name:'Surat',hq:'Surat',population:'44.6 L',famous:'Diamond City, Dumas Beach, Dutch Garden'},
        {id:'vadodara',name:'Vadodara',hq:'Vadodara',population:'41.7 L',famous:'Laxmi Vilas Palace, Sayaji Garden, MS University'},
        {id:'rajkot',name:'Rajkot',hq:'Rajkot',population:'38.0 L',famous:'Mahatma Gandhi childhood home, Aji Dam'},
        {id:'bhavnagar',name:'Bhavnagar',hq:'Bhavnagar',population:'28.8 L',famous:'Velavadar Blackbuck National Park, Alang Ship Breaking'},
        {id:'junagadh',name:'Junagadh',hq:'Junagadh',population:'27.4 L',famous:'Gir Forest, Junagadh Fort, Girnar Hills'}
    ]
},
'delhi': {
    name:'Delhi (NCT)',capital:'New Delhi',emoji:'\ud83c\udfd9\ufe0f',pop:'1.9 Cr',population:'1,90,00,000',area:'1,484 km\u00b2',lang:'Hindi, English',language:'Hindi, English, Punjabi, Urdu',literacy:'86.21%',established:'1956',zones:'UT',color:'#ea580c',
    famousPlaces:[
        {name:'Red Fort',icon:'\ud83c\udff0',description:'UNESCO World Heritage Site. Mughal-era fort where PM hoists flag on Independence Day.',location:true},
        {name:'India Gate',icon:'\ud83c\udfdb\ufe0f',description:'War memorial on Rajpath. 42m tall arch honoring soldiers of World War I.',location:true},
        {name:'Qutub Minar',icon:'\ud83d\udd4c',description:"UNESCO World Heritage Site. World's tallest brick minaret at 72.5m.",location:true},
        {name:'Lotus Temple',icon:'\ud83d\uded5',description:"Baha'i House of Worship shaped like a lotus flower. Open to all faiths.",location:true},
        {name:'Akshardham Temple',icon:'\ud83d\uded5',description:'Magnificent Hindu temple complex with exhibitions, boat ride, and musical fountain.',location:true}
    ],
    connectivity:{airports:'Indira Gandhi International Airport (DEL)',railways:'New Delhi, Old Delhi, Hazrat Nizamuddin, Anand Vihar',highways:'NH-44, NH-48, NH-24, NH-8',ports:'Inland Container Depot, Tughlakabad'},
    govOffices:[
        {type:'Government Office',name:'Delhi Secretariat',address:'IP Estate, New Delhi',phone:'011-23392020',timing:'9:30 AM - 6:00 PM'},
        {type:'Hospital',name:'AIIMS New Delhi',address:'Ansari Nagar, New Delhi',phone:'011-26588500',timing:'24/7'},
        {type:'Hospital',name:'Safdarjung Hospital',address:'Safdarjung Enclave, New Delhi',phone:'011-26707437',timing:'24/7'},
        {type:'Police Station',name:'Delhi Police HQ',address:'ITO, New Delhi',phone:'011-23490200',timing:'24/7'},
        {type:'Fire Station',name:'Delhi Fire Service HQ',address:'Connaught Place, New Delhi',phone:'011-23414444',timing:'24/7'}
    ],
    districts:[
        {id:'central-delhi',name:'Central Delhi',hq:'Daryaganj',population:'5.8 L',famous:'Connaught Place, Jantar Mantar, Chandni Chowk'},
        {id:'new-delhi',name:'New Delhi',hq:'New Delhi',population:'1.4 L',famous:'India Gate, Rashtrapati Bhavan, Parliament'},
        {id:'north-delhi',name:'North Delhi',hq:'Civil Lines',population:'8.9 L',famous:'Delhi University, Kamla Nagar, Civil Lines'},
        {id:'south-delhi',name:'South Delhi',hq:'Saket',population:'27.3 L',famous:'Qutub Minar, Hauz Khas, Saket Mall'},
        {id:'east-delhi',name:'East Delhi',hq:'Preet Vihar',population:'17.1 L',famous:'Akshardham Temple, Patparganj'},
        {id:'west-delhi',name:'West Delhi',hq:'Rajouri Garden',population:'25.4 L',famous:'Rajouri Garden Market, Janakpuri'},
        {id:'north-west-delhi',name:'North West Delhi',hq:'Kanjhawala',population:'36.6 L',famous:'Rohini, Pitampura, Shalimar Bagh'},
        {id:'south-west-delhi',name:'South West Delhi',hq:'Dwarka',population:'22.9 L',famous:'Dwarka, Najafgarh, IGI Airport'},
        {id:'north-east-delhi',name:'North East Delhi',hq:'Nand Nagri',population:'22.4 L',famous:'Yamuna Vihar, Seelampur'},
        {id:'south-east-delhi',name:'South East Delhi',hq:'Defence Colony',population:'14.0 L',famous:'Lotus Temple, Nehru Place, Lajpat Nagar'},
        {id:'shahdara',name:'Shahdara',hq:'Shahdara',population:'15.5 L',famous:'Seelampur Market, Shahdara Industrial'}
    ]
},
'bihar': {
    name:'Bihar',capital:'Patna',emoji:'\ud83c\udfdb\ufe0f',pop:'12.8 Cr',population:'12,80,00,000',area:'94,163 km\u00b2',lang:'Hindi',language:'Hindi, Urdu, Maithili',literacy:'61.80%',established:'1950',zones:'East',color:'#ea580c',
    famousPlaces:[
        {name:'Bodh Gaya (Mahabodhi Temple)',icon:'\ud83d\uded5',description:'UNESCO World Heritage Site where Lord Buddha attained enlightenment.',location:true},
        {name:'Nalanda University Ruins',icon:'\ud83c\udfdb\ufe0f',description:'Ancient university ruins, one of the oldest universities in the world.',location:true},
        {name:'Rajgir',icon:'\u26f0\ufe0f',description:'Ancient capital of Magadha Empire. Hot springs and Griddhakuta Hill.',location:true}
    ],
    connectivity:{airports:'Jay Prakash Narayan Airport (Patna), Gaya',railways:'Patna Junction, Gaya Junction, Muzaffarpur, Darbhanga',highways:'NH-2, NH-28, NH-30, NH-31'},
    govOffices:[
        {type:'Government Office',name:'Bihar Secretariat',address:'Old Secretariat, Patna',phone:'0612-2217956',timing:'10:00 AM - 5:00 PM'},
        {type:'Hospital',name:'Patna Medical College & Hospital',address:'Ashok Rajpath, Patna',phone:'0612-2300343',timing:'24/7'}
    ],
    districts:[
        {id:'patna',name:'Patna',hq:'Patna',population:'58.4 L',famous:'Golghar, Patna Sahib, Kumhrar Park'},
        {id:'gaya',name:'Gaya',hq:'Gaya',population:'43.9 L',famous:'Bodh Gaya, Mahabodhi Temple, Vishnupad Temple'},
        {id:'muzaffarpur',name:'Muzaffarpur',hq:'Muzaffarpur',population:'48.0 L',famous:'Litchi Capital, Muzaffarpur Junction'},
        {id:'bhagalpur',name:'Bhagalpur',hq:'Bhagalpur',population:'30.4 L',famous:'Silk City, Vikramshila University ruins'},
        {id:'darbhanga',name:'Darbhanga',hq:'Darbhanga',population:'39.4 L',famous:'Darbhanga Raj, Madhubani paintings'},
        {id:'nalanda',name:'Nalanda',hq:'Bihar Sharif',population:'28.8 L',famous:'Nalanda University ruins (UNESCO), Rajgir'}
    ]
},
'punjab': {
    name:'Punjab',capital:'Chandigarh',emoji:'\ud83c\udf3e',pop:'3.12 Cr',population:'3,12,00,000',area:'50,362 km\u00b2',lang:'Punjabi',language:'Punjabi',literacy:'75.84%',established:'1966',zones:'North',color:'#ea580c',
    famousPlaces:[
        {name:'Golden Temple (Harmandir Sahib)',icon:'\ud83d\uded5',description:'Holiest shrine in Sikhism. Serves langar to 1 lakh+ people daily.',location:true},
        {name:'Jallianwala Bagh',icon:'\ud83c\udfdb\ufe0f',description:'Memorial of the 1919 massacre. Important historical monument.',location:true},
        {name:'Wagah Border',icon:'\ud83c\uddf5\ud83c\uddf0',description:'India-Pakistan border with famous flag-lowering ceremony every evening.',location:true}
    ],
    connectivity:{airports:'Sri Guru Ram Dass Jee International (Amritsar), Chandigarh',railways:'Amritsar Junction, Ludhiana, Jalandhar City',highways:'NH-44, NH-1, NH-15, NH-21'},
    govOffices:[
        {type:'Government Office',name:'Punjab Civil Secretariat',address:'Sector 1, Chandigarh',phone:'0172-2740001',timing:'9:00 AM - 5:00 PM'},
        {type:'Hospital',name:'Guru Nanak Dev Hospital',address:'Amritsar',phone:'0183-2258836',timing:'24/7'}
    ],
    districts:[
        {id:'amritsar',name:'Amritsar',hq:'Amritsar',population:'24.9 L',famous:'Golden Temple, Jallianwala Bagh, Wagah Border'},
        {id:'ludhiana',name:'Ludhiana',hq:'Ludhiana',population:'34.9 L',famous:'Industrial city, Punjab Agricultural University'},
        {id:'jalandhar',name:'Jalandhar',hq:'Jalandhar',population:'21.8 L',famous:'Sports goods hub, Devi Talab Mandir'},
        {id:'patiala',name:'Patiala',hq:'Patiala',population:'19.0 L',famous:'Qila Mubarak, Sheesh Mahal, Patiala salwar'},
        {id:'bathinda',name:'Bathinda',hq:'Bathinda',population:'13.9 L',famous:'Qila Mubarak Fort, Thermal Plant'}
    ]
}
};

// Generate districts data with mandals and government offices
function generateDistrictDetail(stateId, districtId) {
    const state = INDIA_DIRECTORY[stateId];
    if (!state) return null;
    const dist = state.districts ? state.districts.find(d => d.id === districtId) : null;
    if (!dist) return null;

    // Generate mandals (3-8 per district)
    const mandalNames = getMandalNames(stateId, districtId);
    const mandals = mandalNames.map((name, i) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: name,
        villages: Math.floor(Math.random() * 40) + 15,
        population: (Math.floor(Math.random() * 200) + 50) + ',000'
    }));

    // Generate government offices for district
    const govOffices = generateGovOffices(dist.name, state.name);

    return {
        id: dist.id,
        name: dist.name,
        stateName: state.name,
        headquarters: dist.hq || dist.name,
        population: dist.population || 'N/A',
        area: (Math.floor(Math.random() * 5000) + 1000) + ' km\u00b2',
        pincode: generatePincode(stateId),
        stdCode: generateSTDCode(stateId, districtId),
        famous: dist.famous || '',
        connectivity: `${dist.name} is well connected by road via state highways and NH. The nearest railway station is ${dist.hq || dist.name} and nearest airport is at ${state.capital}. Regular bus services connect to all major towns.`,
        mandalCount: mandals.length,
        mandals: mandals,
        govOffices: govOffices
    };
}

function generateMandalDetail(stateId, districtId, mandalId) {
    const state = INDIA_DIRECTORY[stateId];
    if (!state) return null;
    const dist = state.districts ? state.districts.find(d => d.id === districtId) : null;
    if (!dist) return null;

    const mandalNames = getMandalNames(stateId, districtId);
    const mandalName = mandalNames.find(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-') === mandalId) || mandalId;

    // Generate villages (10-25 per mandal)
    const villageNames = getVillageNames(stateId, districtId, mandalId);
    const villages = villageNames.map((name, i) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: name,
        population: (Math.floor(Math.random() * 5000) + 500).toLocaleString(),
        pincode: generatePincode(stateId)
    }));

    const govOffices = generateGovOffices(mandalName, dist.name + ', ' + state.name);

    return {
        id: mandalId,
        name: mandalName,
        stateName: state.name,
        districtName: dist.name,
        population: (Math.floor(Math.random() * 200) + 50) + ',000',
        area: (Math.floor(Math.random() * 500) + 100) + ' km\u00b2',
        pincode: generatePincode(stateId),
        famous: `${mandalName} is known for its agricultural produce, local temples, and cultural heritage. The area has good connectivity to ${dist.hq || dist.name} district headquarters.`,
        villageCount: villages.length,
        villages: villages,
        govOffices: govOffices
    };
}

function generateVillageDetail(stateId, districtId, mandalId, villageId) {
    const state = INDIA_DIRECTORY[stateId];
    if (!state) return null;
    const dist = state.districts ? state.districts.find(d => d.id === districtId) : null;
    if (!dist) return null;

    const mandalNames = getMandalNames(stateId, districtId);
    const mandalName = mandalNames.find(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-') === mandalId) || mandalId;
    const villageNames = getVillageNames(stateId, districtId, mandalId);
    const villageName = villageNames.find(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-') === villageId) || villageId;

    const pop = Math.floor(Math.random() * 5000) + 500;
    const govOffices = [
        {type:'Police Station',name:`${villageName} Police Station`,address:`Main Road, ${villageName}, ${dist.name}`,phone:generatePhone(stateId),timing:'24/7'},
        {type:'Hospital',name:`${villageName} Primary Health Centre`,address:`${villageName}, ${mandalName}, ${dist.name}`,phone:generatePhone(stateId),timing:'9:00 AM - 5:00 PM'},
        {type:'Post Office',name:`${villageName} Post Office`,address:`${villageName}, ${mandalName}, ${dist.name}`,phone:generatePhone(stateId),timing:'9:00 AM - 5:00 PM'},
        {type:'School',name:`Government High School, ${villageName}`,address:`${villageName}, ${mandalName}`,phone:generatePhone(stateId),timing:'8:00 AM - 4:00 PM'},
        {type:'Bank',name:`State Bank of India, ${villageName}`,address:`Main Road, ${villageName}`,phone:generatePhone(stateId),timing:'10:00 AM - 4:00 PM'},
        {type:'Government Office',name:`Village Panchayat Office`,address:`${villageName}, ${mandalName}, ${dist.name}`,phone:generatePhone(stateId),timing:'10:00 AM - 5:00 PM'}
    ];

    return {
        id: villageId,
        name: villageName,
        stateName: state.name,
        districtName: dist.name,
        mandalName: mandalName,
        population: pop.toLocaleString(),
        area: (Math.random() * 20 + 2).toFixed(1) + ' km\u00b2',
        pincode: generatePincode(stateId),
        literacy: (Math.random() * 30 + 55).toFixed(1) + '%',
        postOffice: villageName + ' B.O.',
        policeStation: mandalName + ' P.S.',
        famous: `${villageName} is a village in ${mandalName} mandal of ${dist.name} district, ${state.name}. The village is known for its agriculture-based economy. Major crops include rice, wheat, and pulses. The village has a primary school, health center, and is connected by road to ${mandalName} and ${dist.hq || dist.name}.`,
        connectivity: `${villageName} is located in ${mandalName} mandal. The nearest town is ${dist.hq || dist.name} (district HQ). Connected by state road. Nearest railway station: ${dist.hq || dist.name}. Nearest bus stop: ${mandalName} bus stand. Nearest airport: ${state.capital}.`,
        govOffices: govOffices
    };
}

function generateGovOffices(placeName, locationContext) {
    return [
        {type:'Police Station',name:`${placeName} Police Station`,address:`Main Road, ${placeName}`,phone:generatePhone(),timing:'24/7'},
        {type:'Hospital',name:`District Hospital, ${placeName}`,address:`Hospital Road, ${placeName}`,phone:generatePhone(),timing:'24/7'},
        {type:'Hospital',name:`Community Health Centre`,address:`${placeName}`,phone:generatePhone(),timing:'8:00 AM - 8:00 PM'},
        {type:'Fire Station',name:`Fire Station, ${placeName}`,address:`${placeName}`,phone:generatePhone(),timing:'24/7'},
        {type:'Bank',name:`State Bank of India, ${placeName}`,address:`Main Branch, ${placeName}`,phone:generatePhone(),timing:'10:00 AM - 4:00 PM'},
        {type:'Bank',name:`Indian Bank, ${placeName}`,address:`${placeName}`,phone:generatePhone(),timing:'10:00 AM - 4:00 PM'},
        {type:'Post Office',name:`Head Post Office, ${placeName}`,address:`${placeName}`,phone:generatePhone(),timing:'9:00 AM - 5:00 PM'},
        {type:'School',name:`Government High School, ${placeName}`,address:`${placeName}`,phone:generatePhone(),timing:'8:00 AM - 4:00 PM'},
        {type:'College',name:`Government Degree College, ${placeName}`,address:`College Road, ${placeName}`,phone:generatePhone(),timing:'9:00 AM - 4:00 PM'},
        {type:'Court',name:`Sub-Division Court, ${placeName}`,address:`Court Road, ${placeName}`,phone:generatePhone(),timing:'10:00 AM - 4:30 PM'},
        {type:'Bus Stand',name:`${placeName} Bus Stand`,address:`${placeName}`,phone:generatePhone(),timing:'5:00 AM - 10:00 PM'},
        {type:'Government Office',name:`Tahsildar Office, ${placeName}`,address:`${placeName}`,phone:generatePhone(),timing:'10:00 AM - 5:00 PM'}
    ];
}

function generatePhone(stateId) {
    const codes = {'andhra-pradesh':'0866','telangana':'040','tamil-nadu':'044','karnataka':'080','maharashtra':'022','uttar-pradesh':'0522','rajasthan':'0141','kerala':'0471','west-bengal':'033','gujarat':'079','delhi':'011','bihar':'0612','punjab':'0172'};
    const code = codes[stateId] || '0' + (Math.floor(Math.random() * 900) + 100);
    return code + '-' + (Math.floor(Math.random() * 9000000) + 1000000);
}

function generatePincode(stateId) {
    const prefixes = {'andhra-pradesh':'5','telangana':'5','tamil-nadu':'6','karnataka':'5','maharashtra':'4','uttar-pradesh':'2','rajasthan':'3','kerala':'6','west-bengal':'7','gujarat':'3','delhi':'1','bihar':'8','punjab':'1'};
    const p = prefixes[stateId] || String(Math.floor(Math.random() * 8) + 1);
    return p + String(Math.floor(Math.random() * 90000) + 10000);
}

function generateSTDCode(stateId, districtId) {
    const codes = {'hyderabad':'040','chennai':'044','bengaluru-urban':'080','mumbai':'022','delhi':'011','kolkata':'033','lucknow':'0522','jaipur':'0141','patna':'0612','ahmedabad':'079'};
    return codes[districtId] || '0' + (Math.floor(Math.random() * 900) + 100);
}

function getMandalNames(stateId, districtId) {
    const mandalData = {
        'andhra-pradesh': {
            'anantapur': ['Anantapur Urban','Dharmavaram','Hindupur','Kadiri','Guntakal','Penukonda','Tadpatri'],
            'chittoor': ['Tirupati Urban','Chittoor','Madanapalle','Srikalahasti','Pileru','Punganur','Puttur'],
            'east-godavari': ['Kakinada Urban','Rajahmundry Urban','Amalapuram','Rampachodavaram','Tuni','Peddapuram'],
            'guntur': ['Guntur','Tenali','Mangalagiri','Narasaraopet','Sattenapalli','Vinukonda','Piduguralla'],
            'krishna': ['Vijayawada Urban','Machilipatnam','Gudivada','Nuzvid','Jaggaiahpet','Nandigama'],
            'visakhapatnam': ['Visakhapatnam Urban','Anakapalle','Gajuwaka','Pendurthi','Narsipatnam','Araku Valley'],
            'default': ['Headquarters','North','South','East','West']
        },
        'telangana': {
            'hyderabad': ['Charminar','Secunderabad','Ameerpet','Jubilee Hills','LB Nagar','Kukatpally'],
            'rangareddy': ['Shamshabad','Rajendranagar','Ibrahimpatnam','Chevella','Maheshwaram','Shadnagar'],
            'warangal-urban': ['Warangal','Hanamkonda','Kazipet','Hasanparthy','Elkathurthy'],
            'karimnagar': ['Karimnagar','Huzurabad','Jammikunta','Choppadandi','Manakondur'],
            'default': ['Headquarters','East','West','North','South']
        },
        'tamil-nadu': {
            'chennai': ['Egmore-Nungambakkam','Tondiarpet','Mylapore-Triplicane','Mambalam-Guindy','Perambur','Ambattur','Adyar','Sholinganallur'],
            'coimbatore': ['Coimbatore North','Coimbatore South','Pollachi','Mettupalayam','Valparai','Sulur'],
            'madurai': ['Madurai North','Madurai South','Melur','Thirumangalam','Peraiyur','Usilampatti'],
            'default': ['Headquarters','North','South','East','West','Central']
        },
        'karnataka': {
            'bengaluru-urban': ['Bengaluru North','Bengaluru South','Bengaluru East','Anekal','Yelahanka','Dasarahalli'],
            'mysuru': ['Mysuru','Nanjangud','Hunsur','T Narasipura','Periyapatna','H.D. Kote'],
            'default': ['Headquarters','North','South','East','West']
        },
        'maharashtra': {
            'pune': ['Pune City','Haveli','Maval','Mulshi','Baramati','Shirur','Junnar','Bhor','Indapur'],
            'mumbai': ['Fort','Colaba','Dongri','Byculla','Grant Road','Malabar Hill'],
            'nagpur': ['Nagpur Urban','Nagpur Rural','Kamptee','Hingna','Saoner','Ramtek','Katol'],
            'nashik': ['Nashik','Igatpuri','Trimbakeshwar','Sinnar','Niphad','Dindori','Yeola'],
            'default': ['Headquarters','North','South','East','West','Central']
        },
        'uttar-pradesh': {
            'lucknow': ['Lucknow','Mohanlalganj','Bakshi Ka Talab','Malihabad','Sarojini Nagar','Chinhat'],
            'agra': ['Agra','Kheragarh','Fatehabad','Etmadpur','Bah','Kiraoli'],
            'varanasi': ['Varanasi','Pindra','Chiraigaon','Kashi Vidyapith','Harahua','Sevapuri'],
            'default': ['Headquarters','North','South','East','West','Sadar']
        },
        'rajasthan': {
            'jaipur': ['Jaipur','Amber','Sanganer','Shahpura','Phagi','Chaksu','Jamwaramgarh'],
            'jodhpur': ['Jodhpur','Phalodi','Bilara','Osian','Shergarh','Luni'],
            'udaipur': ['Udaipur','Girwa','Vallabhnagar','Gogunda','Salumber','Sarada'],
            'default': ['Headquarters','North','South','East','West']
        },
        'delhi': {
            'central-delhi': ['Chandni Chowk','Daryaganj','Karol Bagh','Pahar Ganj'],
            'new-delhi': ['Connaught Place','Chanakyapuri','RK Puram','Lodhi Colony'],
            'south-delhi': ['Saket','Hauz Khas','Greater Kailash','Mehrauli','Lajpat Nagar'],
            'default': ['Sector 1','Sector 2','Sector 3','Sector 4']
        }
    };

    const stateData = mandalData[stateId] || {};
    return stateData[districtId] || stateData['default'] || ['North','South','East','West','Central'];
}

function getVillageNames(stateId, districtId, mandalId) {
    // Generate realistic village names based on state/region
    const suffixes = {
        'andhra-pradesh': ['palli','puram','patnam','cherla','gudem','nagar','peta'],
        'telangana': ['palli','peta','nagar','gudem','guda','pur','khurd'],
        'tamil-nadu': ['patti','palayam','puram','nallur','mangalam','ur','kudi'],
        'karnataka': ['halli','pura','nagar','koppal','gudda','nayakanahatti'],
        'maharashtra': ['wadi','gaon','khurd','budruk','nagar','tanda','patan'],
        'uttar-pradesh': ['pur','nagar','ganj','garhi','khera','patti','gaon'],
        'rajasthan': ['pur','garh','nagar','khera','was','kalan','khurd'],
        'kerala': ['puram','kulam','nallur','thara','kkara','ur','ad'],
        'west-bengal': ['pur','gram','gaon','para','tala','danga','nagar'],
        'gujarat': ['pur','nagar','wadi','pura','gam','vas','khurd'],
        'delhi': ['Vihar','Nagar','Colony','Enclave','Extension','Puri','Garhi'],
        'bihar': ['pur','ganj','nagar','garh','patti','chak','diara'],
        'punjab': ['pur','nagar','wala','garh','heri','kalan','khurd']
    };

    const prefixes = ['Rama','Krishna','Lakshmi','Ganga','Surya','Shiva','Venkata','Nalla','Pedda','Chinna','Maha','Adi','Raja','Rani','Deva','Siri','Bala','Gopi','Dharma','Satya'];

    const stateSuffixes = suffixes[stateId] || ['pur','nagar','gaon','palli','ganj'];
    const count = Math.floor(Math.random() * 8) + 10;
    const villages = [];
    for (let i = 0; i < count; i++) {
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = stateSuffixes[Math.floor(Math.random() * stateSuffixes.length)];
        villages.push(prefix + suffix);
    }
    return [...new Set(villages)].slice(0, count);
}

module.exports = { INDIA_DIRECTORY, generateDistrictDetail, generateMandalDetail, generateVillageDetail };
