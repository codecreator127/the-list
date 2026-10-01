import type { Place, Review, User } from '../types/models';
export const users: User[] = [
 {id:'u1',name:'Maya Chen',handle:'mayacooks',initials:'MC',color:'#D9A482'},{id:'u2',name:'Oliver James',handle:'oliverj',initials:'OJ',color:'#8CA79A'},
 {id:'u3',name:'Sophie Patel',handle:'sophp',initials:'SP',color:'#C99AA4'},{id:'u4',name:'Noah Williams',handle:'noahw',initials:'NW',color:'#A9A38A'},
 {id:'u5',name:'Isabella Rossi',handle:'bellarossi',initials:'IR',color:'#B58E6F'},{id:'u6',name:'Ethan Kim',handle:'ethank',initials:'EK',color:'#8EA6B0'},
 {id:'u7',name:'Amara Okafor',handle:'amarao',initials:'AO',color:'#B68E70'}
];
export const places: Place[] = [
 {id:'p1',name:'Luna Lu',category:'Modern Chinese',cuisine:'Chinese',area:'Surry Hills',address:'4–10 Foster St, Surry Hills',latitude:-33.8832,longitude:151.2111,image:'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=85',price:'$$',description:'A lively neighbourhood dining room for punchy flavours and a very good night out.',averageRating:0,reviewCount:0},
 {id:'p2',name:'Cafe Paci',category:'Nordic · European',cuisine:'Cafe',area:'Newtown',address:'131 King St, Newtown',latitude:-33.8978,longitude:151.1796,image:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=85',price:'$$$',description:'Playful, thoughtful cooking in a warm dining room on King Street.',averageRating:0,reviewCount:0},
 {id:'p3',name:'Totti’s',category:'Italian',cuisine:'Italian',area:'Bondi',address:'283 Bondi Rd, Bondi',latitude:-33.8911,longitude:151.2653,image:'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=85',price:'$$',description:'Wood-fired bread, handmade pasta and long lunches that turn into dinner.',averageRating:0,reviewCount:0},
 {id:'p4',name:'Saint Peter',category:'Seafood',cuisine:'Seafood',area:'Paddington',address:'362 Oxford St, Paddington',latitude:-33.8843,longitude:151.2265,image:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85',price:'$$$$',description:'A fresh take on Australian seafood, served with care and creativity.',averageRating:0,reviewCount:0},
 {id:'p5',name:'Chin Chin',category:'Thai',cuisine:'Thai',area:'Surry Hills',address:'69 Commonwealth St, Surry Hills',latitude:-33.8821,longitude:151.2101,image:'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=85',price:'$$',description:'Big Thai flavours, a buzzing dining room and a menu made for sharing.',averageRating:0,reviewCount:0},
 {id:'p6',name:'Bar Ume',category:'Japanese · Burgers',cuisine:'Japanese',area:'Surry Hills',address:'478 Bourke St, Surry Hills',latitude:-33.8848,longitude:151.2127,image:'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=85',price:'$$',description:'A Japanese spin on comfort food with a cult following.',averageRating:0,reviewCount:0},
 {id:'p7',name:'AP Bakery',category:'Bakery · Cafe',cuisine:'Cafe',area:'Surry Hills',address:'80 Commonwealth St, Surry Hills',latitude:-33.8831,longitude:151.2106,image:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=85',price:'$',description:'Flaky pastries, excellent coffee and a rooftop worth finding.',averageRating:0,reviewCount:0},
 {id:'p8',name:'Porcine',category:'French',cuisine:'French',area:'Paddington',address:'268 Oxford St, Paddington',latitude:-33.8845,longitude:151.2282,image:'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=1200&q=85',price:'$$$',description:'French bistro comfort with generous plates and a thoughtful wine list.',averageRating:0,reviewCount:0},
 {id:'p9',name:'Cafe Monaka',category:'Japanese · Cafe',cuisine:'Japanese',area:'Alexandria',address:'147 McEvoy St, Alexandria',latitude:-33.9084,longitude:151.1946,image:'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=1200&q=85',price:'$$',description:'A calm little cafe for a beautifully balanced Japanese-inspired brunch.',averageRating:0,reviewCount:0},
 {id:'p10',name:'The Apollo',category:'Greek',cuisine:'Greek',area:'Potts Point',address:'44 Macleay St, Potts Point',latitude:-33.8694,longitude:151.2273,image:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=85',price:'$$$',description:'Greek cooking over fire in a bright, bustling room.',averageRating:0,reviewCount:0},
 {id:'p11',name:'Rising Sun Workshop',category:'Japanese · Ramen',cuisine:'Japanese',area:'Newtown',address:'1C Whateley St, Newtown',latitude:-33.8976,longitude:151.1792,image:'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&q=85',price:'$$',description:'Community-minded ramen and motorcycles on the edge of King Street.',averageRating:0,reviewCount:0},
 {id:'p12',name:'Bistecca',category:'Italian · Steak',cuisine:'Italian',area:'Sydney CBD',address:'3 Dalley St, Sydney',latitude:-33.8651,longitude:151.2072,image:'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=85',price:'$$$$',description:'A candlelit, no-menu steakhouse built around one perfect cut.',averageRating:0,reviewCount:0}
];
export const reviews: Review[] = [
 {id:'r1',placeId:'p1',userId:'u1',rating:5,text:'The crispy eggplant is the kind of dish you think about on the way home. Great energy, great everything.',date:'2 days ago'},
 {id:'r2',placeId:'p4',userId:'u2',rating:5,text:'An absolute masterclass in making the most of local fish. The menu changes, the care doesn’t.',date:'3 days ago'},
 {id:'r3',placeId:'p2',userId:'u3',rating:4,text:'Come hungry and let them guide you. Clever without ever taking itself too seriously.',date:'4 days ago'},
 {id:'r4',placeId:'p3',userId:'u4',rating:5,text:'That bread. That butter. We ordered a second round before our mains even arrived.',date:'5 days ago'},
 {id:'r5',placeId:'p7',userId:'u5',rating:5,text:'Worth getting up early for the pastries. The rooftop is a lovely bonus.',date:'1 week ago'},
 {id:'r6',placeId:'p1',userId:'u6',rating:4,text:'Such a fun menu for sharing. Book ahead if you want a Friday table.',date:'1 week ago'},
 {id:'r7',placeId:'p5',userId:'u7',rating:5,text:'A Surry Hills classic for good reason. The son-in-law eggs are a must.',date:'1 week ago'},
 {id:'r8',placeId:'p8',userId:'u1',rating:5,text:'Cosy, generous and quietly special. The sort of place you want to keep to yourself.',date:'2 weeks ago'},
 {id:'r9',placeId:'p10',userId:'u2',rating:4,text:'The lamb shoulder disappeared in minutes. Lively room and genuinely lovely service.',date:'2 weeks ago'},
 {id:'r10',placeId:'p11',userId:'u3',rating:4,text:'Rich broth, chewy noodles, and a playlist that somehow makes the whole meal better.',date:'2 weeks ago'},
 {id:'r11',placeId:'p12',userId:'u4',rating:5,text:'An occasion in itself. Order the steak medium rare and don’t skip the anchovy toast.',date:'3 weeks ago'},
 {id:'r12',placeId:'p6',userId:'u5',rating:4,text:'The miso wagyu burger is messy in the best possible way.',date:'3 weeks ago'},
 {id:'r13',placeId:'p9',userId:'u6',rating:5,text:'A slower, lovelier kind of brunch. The matcha french toast is excellent.',date:'3 weeks ago'},
 {id:'r14',placeId:'p3',userId:'u7',rating:4,text:'A great spot for a big group. Pasta is the move, but save room for dessert.',date:'1 month ago'},
 {id:'r15',placeId:'p4',userId:'u1',rating:5,text:'Every course had a little surprise. Sydney seafood at its most thoughtful.',date:'1 month ago'},
 {id:'r16',placeId:'p2',userId:'u2',rating:5,text:'The potato bread should be illegal. Intimate, inventive and worth the trip.',date:'1 month ago'},
 {id:'r17',placeId:'p5',userId:'u3',rating:4,text:'Unapologetically bold flavours and the best kind of dinner-party buzz.',date:'1 month ago'},
 {id:'r18',placeId:'p7',userId:'u4',rating:5,text:'Pistachio croissant was a highlight. Coffee is solid too.',date:'1 month ago'},
 {id:'r19',placeId:'p9',userId:'u5',rating:4,text:'Lovely calm spot for brunch. The Japanese breakfast set was fresh and generous.',date:'1 month ago'},
 {id:'r20',placeId:'p8',userId:'u6',rating:5,text:'Beautifully cooked, no-fuss French food and a wine list full of good surprises.',date:'1 month ago'},
 {id:'r21',placeId:'p12',userId:'u7',rating:4,text:'A memorable steak and a great room for a special dinner in the city.',date:'1 month ago'},
 {id:'r22',placeId:'p6',userId:'u2',rating:5,text:'Crispy fries, excellent burger and a fun relaxed vibe. Already planning a return.',date:'1 month ago'}
];
