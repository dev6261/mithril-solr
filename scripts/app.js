var SolrWidget = (function(SolrWidget, window, undefined){


    /**
    * Has the following components
    * 1. Search form
    * 2. Results
    * 3. Result sorting
    * 4. Facet filtering
    * 5. Export to XML/JSON/CSV
    * 6. Currently Selected facets
    * 7. Pagination
    *
    *
    * Configurable parameters
    * q, rows, start
    */
   
  
    /**
    * Base controller with diff redraw
    */
    
    var BaseDiffController = function(constructor) {
        return function() {
            m.redraw.strategy("diff")
            return constructor.apply(this, arguments)
        }
    }

    /**
     * Default Parameters
     */
    
    var defaultSolrParams = [        
        {
            name: 'wt',
            value: 'json'
        }        
        ,{
            name: 'facet',
            value: 'true'
        }
    ];

    /**
     * Decoder
     */
    
    function decoder(text){

        return decodeURIComponent(text).replace(/\+/g, ' ');
    }

    /**
     * Build Query Strings
     */
    
    function buildQueryString(obj){

        var str = []

        for(var i = 0; i < obj.length; i++){
            str.push(
                encodeURIComponent(obj[i]['name']) + "=" + 
                encodeURIComponent(obj[i]['value'])
            )
        }
        
        return str.join('&')
    }
   
   /**
    * View model
    */
   
    SolrWidget.vm = {
        init: function(){

            var q = m.route.param('q')? decoder(m.route.param('q')) : '';

            this.q =  m.prop(q);

            this.isSearching = false;

            this.docs = this.docs || m.prop([]);

            this.facets = this.facets || m.prop({});

            this.numFound = this.numFound || m.prop(0);

            this.perPage = m.prop(m.route.param('rows') || 20);

            
            /* Sorting */


            /* Re-calculate Current Page */

            this.currentPage = m.prop(0);

            if(m.route.param('start') && m.route.param('rows')){
                this.currentPage(Math.ceil(m.route.param('start')/m.route.param('rows')))
            }
        },

        getFacetProp:  function(name, prop){

            var title = '';

            for(var i = 0; i < SolrWidget.vm.facetFields.length; i++){
                
                if(SolrWidget.vm.facetFields[i]['name'] == name) title = SolrWidget.vm.facetFields[i][prop]
            }

            return title
        },

        sanitize: function(str){

            /* Removes quotes at the beginning and end of string */

            return str.replace(/^\"|\"$/gi, '');
        }
    };


    /**
     * Cache
     */
    
    SolrWidget.cache  = {}



    /**
     * Widget View
     * @param  {[object]} ctrl [description]
     * @param  {[object]} args [description]
     * @return {[type]}      [description]
     */
    SolrWidget.view = function(ctrl, args){            

            
            return m('.msolr', [
                
                m.component(SolrWidget.SearchForm, { 
                    onSubmit    : ctrl.formSubmit, 
                    isSearching : SolrWidget.vm.isSearching,
                    q           : SolrWidget.vm.q,
                    numFound : SolrWidget.vm.numFound
                }),                
                m('.msolr-content', [
                    m.component(SolrWidget.Pagination, {
                        perPage  : SolrWidget.vm.perPage,
                        numFound : SolrWidget.vm.numFound,
                        currentPage : SolrWidget.vm.currentPage,
                        changePage: ctrl.changePage,
                        nextPage: ctrl.nextPage,
                        prevPage: ctrl.prevPage
                    }),
                    m.component(SolrWidget.SearchSelectedFacets, {                     
                        selectedFacets : ctrl.selectedFacets,
                        facetFields    : args.facetFields,
                        removeFacet    : ctrl.removeFacet
                    }),
                    m.component(SolrWidget.SearchFacets, {                        
                        facets      : SolrWidget.vm.facets,
                        facetFields : args.facetFields,
                        onSelect    : ctrl.selectFacet
                    }),
                    m.component(SolrWidget.SearchResults, { 
                        docs   : SolrWidget.vm.docs,
                        fields : args.fields,
                        q      : SolrWidget.vm.q,
                        isSearching : SolrWidget.vm.isSearching,
                    }),
                    m.component(SolrWidget.Pagination, {
                        perPage  : SolrWidget.vm.perPage,
                        numFound : SolrWidget.vm.numFound,
                        currentPage : SolrWidget.vm.currentPage,
                        changePage: ctrl.changePage,
                        nextPage: ctrl.nextPage,
                        prevPage: ctrl.prevPage
                    })
                ])

            ])            
        
    };
    
    /**
     * Controller
     * @param  {[type]} args [description]
     * @return {[type]}      [description]
     */
    SolrWidget.controller = new BaseDiffController(function(args){

            var self = this;

            
            /* Results */
            
            SolrWidget.vm.init();
            

            /* Facet fields */

            this.facetFields = [];

            /* Transfer to VM */

            SolrWidget.vm.facetFields = args.facetFields;

            /* Add facetfields to controller */

            if(args.facetFields){

                for(var i = 0; i < args.facetFields.length; i++){
                    this.facetFields.push({
                        name: 'facet.field',
                        value: args.facetFields[i].name,
                    })
                }
            }

            /* Selected facets */

            this.selectedFacets = [];

            if(m.route.param('fq')){

                var fq = m.route.param('fq');

                if(typeof fq == 'string') {
                    fq = fq.replace(/\"/g, '\\"');
                    fq = JSON.parse('["' + fq + '"]');
                }

                fq.map(function(f){

                    self.selectedFacets.push({
                        name: 'fq',
                        value: decoder(f)
                    })
                })
            }


            /**
             * Remove facet
             */
            
            this.removeFacet = function(f, event){

                event && event.preventDefault();

                for(var i = 0; i < this.selectedFacets.length; i++){                    
                    if(this.selectedFacets[i].value == f.fullValue){
                        this.selectedFacets.splice(i, 1);
                    }
                }

                SolrWidget.vm.currentPage(0)

                this.route()

            }.bind(this)
            

            /* Parameters */


            /**
             * Handle facet selection
             */
            
            this.selectFacet = function(type, f, event){

                event && event.preventDefault();                
                
                this.selectedFacets.push({
                    name: 'fq',
                    value: type + ':\"' + f + '\"'
                });
                
                SolrWidget.vm.currentPage(0)

                this.route()

            }.bind(this);


            /**
             * Page select
             */
            
            this.changePage = function(page, event){

                event && event.preventDefault();

                SolrWidget.vm.currentPage(page);

                this.route();
            
            }.bind(this)

            /**
             * Previous page
             */
            
            this.prevPage = function(total, event){

                event && event.preventDefault();

                var current = SolrWidget.vm.currentPage();

                --current;

                if(current < 0){
                    current = 0;
                }

                SolrWidget.vm.currentPage(current)

                this.route();
            
            }.bind(this)

            /**
             * Next page
             */
            
            this.nextPage = function(total, event){

                event && event.preventDefault();

                var current = SolrWidget.vm.currentPage();

                ++current;

                if(current > (total - 1)){
                    current = (total - 1);
                }

                SolrWidget.vm.currentPage(current)

                this.route();
            
            }.bind(this)


            /**
             * Rebuild params
             */
            
            this.buildParams = function(){

                /* Query */
                var query = [{
                    name: 'q',
                    value: SolrWidget.vm.q()
                }];

                /* Page params */

                var pageParams = [{
                    name: 'rows',
                    value: SolrWidget.vm.perPage()
                },{
                    name: 'start',
                    value: SolrWidget.vm.currentPage() * SolrWidget.vm.perPage()
                }];


                /* Sorting */

                // var sortParams = [{
                //     name: 'sort',
                //     value: 'navigation_title_t desc'
                // }];


                /* Merge params */

                var params = [].concat.apply([], [
                    this.facetFields, 
                    defaultSolrParams, 
                    this.selectedFacets,
                    query,
                    pageParams
                ]);                

                /* Removed undefined params */

                params = params.filter(function(n){ return n!= undefined })

                return params;

            }.bind(this)

            
            /**
             * Search
             */
            
            this.route  = function(event){

                event && event.preventDefault();

                queryString = buildQueryString(this.buildParams());

                /* Trigger a new route */

                m.route('/search?' + queryString)

            }.bind(this);

            /**
             * Search
             */
            
            this.search = function(event){

                event && event.preventDefault();

                /* Check if there is query */

                if(!SolrWidget.vm.q()) return;

                SolrWidget.vm.isSearching = true;

                /* Fetch results from server */

                this.fetch().then(function(results){

                    /* Set docs */

                    SolrWidget.vm.docs(results.response.docs)

                    /* Set Facets */

                    SolrWidget.vm.facets(results.facet_counts || '')

                    /* Set Total records */

                    SolrWidget.vm.numFound(results.response.numFound)

                    /* Hide loading indicator */

                    SolrWidget.vm.isSearching = false

                    /* Redraw */

                    m.redraw()

                })
            
            }.bind(this)

            /**
             * Check for Query
             */
            
            this.fetch = function(){


                var data = buildQueryString(this.buildParams());
                

                /* Create cache key */

                var key = JSON.stringify(data);

                if(!SolrWidget.cache[key]){

                    SolrWidget.cache[key] = m.request({
                        url         : args.endPoint + '?' + data,
                        dataType    : 'jsonp',
                        callbackKey : 'json.wrf',
                        background  : true
                    })
                    .then(function(results){
                        
                        return results
                        
                    })
                }

                return SolrWidget.cache[key]

            }.bind(this);


            /**
             * Form Submission
             */
            
            this.formSubmit = function(event){

                event && event.preventDefault();

                /* Check if there is query */

                if(!SolrWidget.vm.q()) return;

                /* Route */

                this.route();
                
            }.bind(this)

            /* Fetch only if there is a query */
            
            if(SolrWidget.vm.q()) {
                
                this.search();

            }else{

                /**
                 * Clear all docs
                 */
                
                SolrWidget.vm.docs([]);

                /**
                * Clear all facets
                */
                
                SolrWidget.vm.facets({});

                /**
                 * Clear numFound
                 */
                
                SolrWidget.vm.numFound(0);

                /* Set current page to zero */

                SolrWidget.vm.currentPage(0);
            }
    });

    
    return SolrWidget;

})(SolrWidget || {}, window);