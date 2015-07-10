'use strict';

require('./fixture/common.js');
require('./fixture/script.js');
var assert = require('chai').assert;
var sinon = require('sinon');

describe('Loader', function () {
    beforeEach(function() {
        Object.keys(require.cache).forEach(function(cache) {
            delete require.cache[cache];
        });

        global.__CONFIG__ = {
            url: __dirname + '/fixture',
            basePath: '/modules',
            maps: {
               'liferay': 'liferay@1.0.0',
               'liferay2': 'liferay@2.0.0'
            },
            modules: {
                module1: {
                    dependencies: ['module2', 'module3']
                },
                module2: {
                    dependencies: []
                },
                module3: {
                    dependencies: []
                },
                module5: {
                    dependencies: ['module6', 'module7', 'exports']
                },
                module6: {
                    dependencies: ['module7', 'exports']
                },
                module7: {
                    dependencies: ['exports']
                },
                moduleMissing: {
                    dependencies: []
                },
                moduleCyclic1: {
                    dependencies: ['moduleCyclic2']
                },
                moduleCyclic2: {
                    dependencies: ['moduleCyclic1']
                },
                'liferay@1.0.0/relative1': {
                    dependencies: ['exports', 'module', './relative2'],
                    path: 'relative1.js'
                },
                'liferay@1.0.0/relative2': {
                    dependencies: ['exports', 'module', './sub-relative/sub-relative1'],
                    path: 'relative2.js'
                },
                'liferay@1.0.0/relative3': {
                    dependencies: ['exports', 'module'],
                    path: 'relative3.js'
                },
                'liferay@1.0.0/sub-relative/sub-relative1': {
                    dependencies: ['exports', 'module', '../relative3'],
                    'path': 'sub-relative/sub-relative1.js'
                },
                'liferay@1.0.0': {
                    dependencies: ['exports'],
                    path: 'liferay.js'
                },
                'liferay@2.0.0': {
                    dependencies: ['exports', 'liferay'],
                    path: 'liferay2.js'
                },
                'exports-dep': {
                    dependencies: ['exports'],
                    path: 'exports-dep.js'
                },
                'module-dep': {
                    dependencies: ['exports', 'module'],
                    path: 'module-dep.js'
                }
            }
        };

        global.__CONFIG__.paths = {};

        require('../umd/config-parser.js');
        require('../umd/event-emitter.js');
        require('../umd/script-loader.js');
    });

    it('should define a module without dependencies (except exports)', function (done) {
        var impl = sinon.spy(function (exports) {
            exports.pejJung = {};
        });

        Loader.define('pej-jung', ['exports'], impl);

        setTimeout(function () {
            assert(impl.notCalled);

            var modules = Loader.getModules();

            var module = modules['pej-jung'];

            assert.ok(module);
            assert.strictEqual('pej-jung', module.name);
            assert.strictEqual(module.pendingImplementation, impl);
            assert.strictEqual(module.requested, undefined);

            done();
        }, 50);
    });

    it('should discover missing dependencies of already defined modules', function() {
        var module1 = Math.random().toString();
        var dep1 = Math.random().toString();

        var module2 = Math.random().toString();
        var dep2 = Math.random().toString();

        Loader.define(module1, [dep1], function() {return 1;});
        Loader.define(module2, [dep2], function() {return 1;});

        var missingDeps = Loader._getMissingDepenencies([module1, module2]);

        assert.isArray(missingDeps);
        assert.strictEqual(2, missingDeps.length);
        assert.sameMembers([dep1, dep2], missingDeps);
    });

    it('should resolve relative dependencies path in define', function() {
        var module = 'test/sub1/' + Math.random().toString();
        var depName = Math.random().toString();
        var dep = '../' + depName;

        Loader.define(module, [dep], function() {});

        var modules = Loader.getModules();

        assert.property(modules, module);
        assert.isArray(modules[module].dependencies);
        assert.strictEqual('test/' + depName, modules[module].dependencies[0]);
    });

    it('should register unregistered modules in require', function() {
        var module = Math.random().toString();

        Loader.require(module);
        var modules = Loader.getModules();

        assert.property(modules, module);
        assert.isObject(modules[module]);
        assert.property(modules[module], 'dependencies');
        assert.isArray(modules[module].dependencies);
    });

    it('should map modules in require', function() {
        var module = Math.random().toString();
        var alias = Math.random().toString();

        global.__CONFIG__.maps[module] = alias;

        Loader.require(module, [], function() {return 1;});
        var modules = Loader.getModules();

        assert.property(modules, alias);
    });

    it('should load already defined (manually) modules', function (done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require(['aui-123', 'pej-jung'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled);
            assert.isTrue(success.calledOnce);

            done();
        }, 50);
    });

    it('should load unregistered modules', function (done) {
        var one;
        var failure = sinon.stub();
        var success = sinon.spy(function(_one) {
            one = _one;
        });

        global.__CONFIG__.paths['one'] = '/modules2/one';
        global.__CONFIG__.paths['two'] = '/modules2/two';
        global.__CONFIG__.paths['three'] = '/modules2/three';

        Loader.require(['one'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled);
            assert.isTrue(success.calledOnce);
            assert.isFunction(one);

            done();
        }, 50);
    });

    it('should load previously registered modules', function (done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require('module1', success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled);
            assert.isTrue(success.calledOnce);

            done();
        }, 50);
    });

    it('should fail on registered but not existing file', function (done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require('moduleMissing', success, failure);

        setTimeout(function () {
            assert.isTrue(failure.calledOnce);
            assert.isTrue(success.notCalled);

            done();
        }, 50);
    });

    it('should fail if there are cyclic dependencies', function (done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require('moduleCyclic1', 'moduleCyclic2', success, failure);

        setTimeout(function () {
            assert.isTrue(failure.calledOnce);
            assert.isTrue(success.notCalled);

            done();
        }, 50);
    });

    it('should succeed when requiring modules multiple times', function (done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require(['module5'], success, failure);
        Loader.require(['module6'], success, failure);
        Loader.require(['module7'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled);
            assert.isTrue(success.calledThrice);

            done();
        }, 50);
    });

    it('should ignore success and callback if not functions', function () {
        Loader.require(['module1'], null, null);
    });

    it('should return conditional modules', function () {
        var conditionalModules = Loader.getConditionalModules();

        assert.deepEqual({}, conditionalModules);
    });

    it('should load aliased modules', function(done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require(['liferay'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled);
            assert.isTrue(success.calledOnce);

            done();
        }, 50);
    });

    it('should load aliased modules with aliased dependencies', function(done) {
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require(['liferay2'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled, 'Failure should be not called');
            assert.isTrue(success.calledOnce, 'Success should be called');

            done();
        }, 50);
    });

    it('should load module with "exports" dependency', function(done) {
        var failure = sinon.stub();

        var successValue;
        var success = sinon.spy(function(val) {
            successValue = val;
        });

        Loader.require(['exports-dep'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled, 'Failure should be not called');
            assert.isTrue(success.calledOnce, 'Success should be called');

            assert.isObject(successValue);
            assert.property(successValue, 'default');
            assert.isFunction(successValue.default);
            assert.strictEqual('alabala', successValue.default.name);

            done();
        }, 50);
    });

    it('should load module with "module" dependency', function(done) {
        var failure = sinon.stub();

        var successValue;
        var success = sinon.spy(function(val) {
            successValue = val;
        });

        Loader.require(['module-dep'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled, 'Failure should be not called');
            assert.isTrue(success.calledOnce, 'Success should be called');

            assert.isFunction(successValue);
            assert.strictEqual('alabala', successValue.name);

            done();
        }, 50);
    });

    it('should load module with relative path', function(done) {
        var failure = sinon.stub();

        var successValue;
        var success = sinon.spy(function(val) {
            successValue = val;
        });

        Loader.require(['liferay/relative1'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled, 'Failure should be not called');
            assert.isTrue(success.calledOnce, 'Success should be called');

            assert.isObject(successValue);

            done();
        }, 50);
    });

    it('should resolve the missing dependencies without multiple require calls', function(done) {
        Loader.require = sinon.spy(Loader.require);
        var failure = sinon.stub();
        var success = sinon.stub();

        Loader.require.call(Loader, ['liferay@1.0.0/relative1'], success, failure);

        setTimeout(function () {
            assert.isTrue(failure.notCalled, 'Failure should be not called');
            assert.isTrue(success.calledOnce, 'Success should be called');
            assert.isTrue(Loader.require.calledOnce, 'Require should be called once');

            done();
        }, 50);
    });
});