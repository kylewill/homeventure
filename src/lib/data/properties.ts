// HomeVenture - Curated Jupiter Farms Properties
// Only showing properties marked for knocking (30 properties)

export interface Property {
  id: number;
  address: string;
  notes: string;
  removed: string;
  beds: number;
  baths: number;
  sqFt: number;
  yearBuilt: number;
  construction: string;
  hasPool: boolean;
  poolType: string;
  price: number | null;
  lat: number;
  lon: number;
  propertyId: number;
}

// User-added properties have string IDs and nullable fields
export interface UserProperty {
  id: string; // UUID starting with 'u'
  address: string;
  notes: string;
  beds: number | null;
  baths: number | null;
  sqFt: number | null;
  yearBuilt: number | null;
  construction: string;
  hasPool: boolean;
  poolType: string;
  price: number | null;
  lat: number;
  lon: number;
  createdAt: string;
  updatedAt: string;
  source?: string;
}

// Unified type for display - can be either hardcoded or user-added
export type DisplayProperty = {
  id: number | string;
  address: string;
  notes: string;
  beds: number | null;
  baths: number | null;
  sqFt: number | null;
  yearBuilt: number | null;
  construction: string;
  hasPool: boolean;
  poolType: string;
  price: number | null;
  lat: number;
  lon: number;
  isUserAdded?: boolean;
};

export interface PropertyStatus {
  status: 'active' | 'knocked' | 'hidden' | 'interested' | 'not-interested' | 'toview';
  notes: string;
  knockedDate: string | null;
  updatedAt: string;
}

// Properties pre-filtered to those marked for knocking
export const PROPERTIES: Property[] = [
  {id:52,address:"17653 126th Ter N",notes:"3 houses down from paved, no screen pool, but screen porch, BEAUTIFUL",removed:"2025-06-20",beds:4,baths:3,sqFt:2401,yearBuilt:2006,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:1200000,lat:26.9375741,lon:-80.2337098,propertyId:42096464},
  {id:64,address:"10045 175th Road North",notes:"Paved, been redone, separate party house, 1.6 mil 2024",removed:"2024-03-18",beds:4,baths:2.5,sqFt:3240,yearBuilt:1974,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:1750000,lat:26.9361033,lon:-80.1919194,propertyId:42101635},
  {id:61,address:"17932 Bridle Ct",notes:"Paved, beautiful, pool in google map pic, probs TOO MUCH $$$, rented",removed:"2023-10-16",beds:4,baths:3,sqFt:2572,yearBuilt:2016,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:2500000,lat:26.9413302,lon:-80.2057582,propertyId:42094642},
  {id:40,address:"15769 Jupiter Farms Rd",notes:"DREAMS, 2 story, all the things",removed:"2021-07-11",beds:4,baths:4,sqFt:3125,yearBuilt:2004,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:997500,lat:26.9093278,lon:-80.1926936,propertyId:42099184},
  {id:35,address:"10608 159th Ct N",notes:"Paved, no pics, 3000 sq ft, looks like a castle",removed:"2021-01-24",beds:4,baths:4.5,sqFt:3024,yearBuilt:2004,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:914000,lat:26.911456,lon:-80.2018334,propertyId:42096647},
  {id:19,address:"13020 158th St N",notes:"Paved, Kyle takes bad notes",removed:"2020-07-07",beds:4,baths:3,sqFt:2245,yearBuilt:2021,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:569000,lat:26.9094517,lon:-80.2400443,propertyId:42099700},
  {id:43,address:"16104 Robin Way",notes:"Paved, 2 story Spanish monastery, out of reach?",removed:"2018-08-20",beds:5,baths:4,sqFt:4350,yearBuilt:2001,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:724000,lat:26.9140809,lon:-80.1765395,propertyId:42128342},
  {id:32,address:"12546 N 169th Ct N",notes:"Paved, bad pics, hard to tell",removed:"2018-04-22",beds:4,baths:3,sqFt:2135,yearBuilt:2002,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:580000,lat:26.9262962,lon:-80.2323605,propertyId:42105131},
  {id:51,address:"17368 Mellen Ln",notes:"Paved, no screen, no pics, maybe?",removed:"2017-06-09",beds:4,baths:2,sqFt:2560,yearBuilt:1994,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:202900,lat:26.9329594,lon:-80.2309576,propertyId:42096406},
  {id:63,address:"10029 N 176th Ct",notes:"Needs updates, not a lot of pics, 2.5 acre, no screen Paved? Or around from paved",removed:"2017-06-09",beds:4,baths:3,sqFt:2450,yearBuilt:2000,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:579900,lat:26.9379833,lon:-80.1919308,propertyId:42096632},
  {id:68,address:"12488 186th St N",notes:"Around corner from paved, screened pool, needs updates, large work garage, 2.2 acre",removed:"2017-06-09",beds:5,baths:3.5,sqFt:3012,yearBuilt:1995,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:750000,lat:26.950964,lon:-80.2305411,propertyId:42105959},
  {id:13,address:"15247 N 92nd",notes:"paved, gravel drive? Pool?",removed:"2016-06-26",beds:4,baths:3,sqFt:3003,yearBuilt:2006,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:479900,lat:26.9008275,lon:-80.180661,propertyId:42132983},
  {id:55,address:"17926 126th Ter N",notes:"paved, screen pool, bad pics, idk",removed:"2014-08-15",beds:5,baths:3,sqFt:1980,yearBuilt:1997,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:359000,lat:26.9411772,lon:-80.2326634,propertyId:42093861},
  {id:10,address:"11285 152nd St N",notes:"Paved, gravel drive?, screen",removed:"2014-07-25",beds:5,baths:3,sqFt:2841,yearBuilt:1999,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:449900,lat:26.9011973,lon:-80.2137527,propertyId:42100415},
  {id:50,address:"12087 175th Rd N",notes:"Paved, pool noscreen?/pavers, 2.5 acres, YouTube walk through",removed:"2014-03-05",beds:5,baths:4,sqFt:5548,yearBuilt:1985,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:null,lat:26.9363796,lon:-80.2252908,propertyId:42105561},
  {id:24,address:"11705 N 164th Ct",notes:"Around corner of Haynie (dirt tho- INTERESTING",removed:"2013-12-01",beds:4,baths:3,sqFt:2537,yearBuilt:1998,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:369000,lat:26.9197216,lon:-80.2195727,propertyId:42097053},
  {id:8,address:"11105 153rd Ct N",notes:"Paved, Screen, no pictures",removed:"2013-09-22",beds:4,baths:2,sqFt:2475,yearBuilt:1990,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:339000,lat:26.9031642,lon:-80.2105148,propertyId:42094433},
  {id:25,address:"16695 Alexander Run",notes:"Paved, pool, no screen",removed:"2013-09-22",beds:4,baths:3,sqFt:2926,yearBuilt:1995,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:619000,lat:26.9232728,lon:-80.2246228,propertyId:42101202},
  {id:41,address:"15864 N 95 Ave",notes:"Paved, no pics, ???",removed:"2013-09-21",beds:4,baths:3,sqFt:3134,yearBuilt:2005,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:479900,lat:26.9103821,lon:-80.1833868,propertyId:42136238},
  {id:45,address:"17172 Brian Way",notes:"Paved, screened pool, needs updates?, 1 acre",removed:"2013-09-21",beds:4,baths:2.5,sqFt:2481,yearBuilt:1995,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:300000,lat:26.930041,lon:-80.2424405,propertyId:42097037},
  {id:66,address:"12390 186th St N",notes:"Down from paved, screen pool, not a lot of pics, but looks good possibility",removed:"2013-09-21",beds:4,baths:2,sqFt:2260,yearBuilt:1997,construction:"Precast Concrete Panel",hasPool:true,poolType:"Inground",price:445000,lat:26.9509301,lon:-80.2293717,propertyId:42098928},
  {id:42,address:"15758 95th Ave N",notes:"Paved, screened pool, 1.25 acres",removed:"2012-10-19",beds:4,baths:3,sqFt:2817,yearBuilt:2002,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:485000,lat:26.9089637,lon:-80.1833999,propertyId:42127243},
  {id:39,address:"15925 91st Ter",notes:"Paved? Can't tell pics",removed:"2012-09-30",beds:4,baths:2.5,sqFt:2488,yearBuilt:2002,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:449000,lat:26.91112,lon:-80.1782927,propertyId:42128250},
  {id:9,address:"10388 154th Rd N",notes:"Paved, no screen, fine",removed:"2012-07-27",beds:4,baths:3.5,sqFt:3488,yearBuilt:2004,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:679000,lat:26.9040097,lon:-80.1988295,propertyId:42096117},
  {id:67,address:"12104 189th Ct N",notes:"Paved, 1.2 acres, screened pool, interesting, not a lot of pics, looks interesting",removed:"2011-07-21",beds:4,baths:4,sqFt:3536,yearBuilt:2006,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:740000,lat:26.955395,lon:-80.2249922,propertyId:42095459},
  {id:57,address:"10844 N Dogwood Trl",notes:"Paved, 2.5 acre, pool no screen, smaller? Needs updates?",removed:"2010-08-16",beds:4,baths:3,sqFt:2218,yearBuilt:1974,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:475000,lat:26.9332565,lon:-80.2052389,propertyId:42103738},
  {id:49,address:"17133 Alexander Run",notes:"Paved, screened pool, no pictures",removed:"2010-06-09",beds:4,baths:3,sqFt:2578,yearBuilt:1996,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:323000,lat:26.9296773,lon:-80.2244381,propertyId:42095431},
  {id:23,address:"12110 Randolph Siding Rd",notes:"Interesting? 2 story, screen",removed:"2009-03-01",beds:4,baths:2.5,sqFt:2121,yearBuilt:1981,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:369500,lat:26.9134863,lon:-80.2259227,propertyId:42104270},
  {id:26,address:"11869 164th Ct N",notes:"Paved, no pics",removed:"2008-02-07",beds:4,baths:3,sqFt:2609,yearBuilt:2003,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:289000,lat:26.9197691,lon:-80.2215831,propertyId:42100587},
  {id:56,address:"17116 106th Terr N (wildwood Rd",notes:"Paved, screen pool, 2.5 acre, barn, no pics",removed:"2005-06-13",beds:4,baths:2,sqFt:2300,yearBuilt:1979,construction:"Concrete Block/Stucco",hasPool:true,poolType:"Inground",price:700000,lat:26.9297957,lon:-80.2011821,propertyId:42096689}
];
